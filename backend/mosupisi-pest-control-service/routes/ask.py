"""
Ask route - RAG-powered pest control Q&A.
Retrieves relevant pest knowledge then generates an answer using llama.cpp
(same local model as planting guide service). Falls back to a structured
knowledge-base answer if the LLM is unavailable.
"""

import logging
import os
from pathlib import Path

from fastapi import APIRouter, Request, HTTPException
from schemas import AskRequest, AskResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Path to shared llama model (reuse from planting guide service)
LLAMA_MODEL_PATH = (
    Path(__file__).parent.parent.parent
    / "mosupisi-planting-guide-service"
    / "models"
    / "mistral-7b-instruct-v0.1.Q4_K_M.gguf"
)

_llm = None


def _get_llm():
    global _llm
    if _llm is not None:
        return _llm

    try:
        from llama_cpp import Llama

        model_path = os.getenv("LLAMA_MODEL_PATH", str(LLAMA_MODEL_PATH))
        if not Path(model_path).exists():
            logger.warning(f"LLaMA model not found at {model_path} - using fallback answers")
            return None

        _llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_threads=4,
            n_gpu_layers=0,
            verbose=False,
        )
        logger.info("LLaMA model loaded for pest control Q&A")
    except Exception as e:
        logger.warning(f"Could not load LLaMA: {e} - using fallback answers")
        _llm = None

    return _llm


def _build_prompt(question: str, context: str, language: str) -> str:
    lang_instruction = (
        "Answer in Sesotho language." if language == "st"
        else "Answer in clear, simple English suitable for a subsistence farmer in Lesotho."
    )
    return (
        f"[INST] You are Mosupisi, an agricultural assistant helping farmers in Lesotho with "
        f"pest identification and control. Use the context below to answer the question.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\n"
        f"{lang_instruction} Be practical, specific to Lesotho conditions, and recommend "
        f"low-cost solutions where possible. If you mention chemical treatments, always mention "
        f"safer biological or cultural alternatives first. [/INST]"
    )


def _fallback_answer(question: str, retrieved: list, language: str) -> str:
    """Generate a structured answer from retrieved chunks without LLM."""
    if not retrieved:
        if language == "st":
            return (
                "Ha ho lemoha likokonyana tse tsamaelanang le potso ea hau. "
                "Kena botobotsing le mooki oa temo bakeng sa thuso."
            )
        return (
            "No specific pest information found for your query. "
            "Please consult your local extension officer for personalised advice."
        )

    # Pick the top knowledge-base result
    top = retrieved[0]
    text = top["text"]

    # Extract the most relevant sections
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    if language == "st":
        intro = "Ho latela lintlha tse fumanoang:"
    else:
        intro = "Based on the available information:"

    # Return top 5 lines as the answer
    answer_lines = [intro] + lines[:8]
    return "\n".join(answer_lines)


def _extract_relevant_pests(retrieved: list, rag) -> list:
    """Pull pest summaries for pests mentioned in retrieved results."""
    pest_ids = set()
    for item in retrieved:
        meta = item.get("metadata", {})
        if meta.get("source") == "knowledge_base" and meta.get("pest_id"):
            pest_ids.add(meta["pest_id"])

    results = []
    for pest_id in list(pest_ids)[:3]:
        pest = rag.get_pest_by_id(pest_id)
        if pest:
            results.append({
                "id": pest["id"],
                "name": pest["name"],
                "name_st": pest["name_st"],
                "scientific_name": pest["scientific_name"],
                "crops": pest["crops"],
                "season": pest["season"],
                "severity": pest["severity"],
                "image_emoji": pest["image_emoji"],
            })
    return results


@router.post("/", response_model=AskResponse)
async def ask_pest_question(request: Request, body: AskRequest):
    """
    Answer a pest control question using RAG.
    Retrieves relevant pest knowledge then generates a contextual answer.
    """
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # Augment query with crop if provided
    search_query = question
    if body.crop:
        search_query = f"{body.crop} {question}"

    # Retrieve relevant context
    retrieved = rag.retrieve(search_query, n_results=5)

    # Build context string
    context_parts = [item["text"] for item in retrieved[:3]]
    context = "\n\n---\n\n".join(context_parts)

    # Try LLM first, fall back to structured answer
    llm = _get_llm()
    if llm and context:
        try:
            prompt = _build_prompt(question, context, body.language)
            output = llm(
                prompt,
                max_tokens=512,
                temperature=0.3,
                stop=["[INST]", "</s>"],
            )
            answer = output["choices"][0]["text"].strip()
        except Exception as e:
            logger.error(f"LLM inference failed: {e}")
            answer = _fallback_answer(question, retrieved, body.language)
    else:
        answer = _fallback_answer(question, retrieved, body.language)

    # Collect sources
    sources = []
    for item in retrieved:
        meta = item.get("metadata", {})
        if meta.get("source") == "pdf":
            sources.append(meta.get("filename", "LMS Bulletin"))
        elif meta.get("source") == "knowledge_base":
            pest_name = meta.get("pest_name", "")
            if pest_name and pest_name not in sources:
                sources.append(pest_name)

    relevant_pests = _extract_relevant_pests(retrieved, rag)

    return AskResponse(
        answer=answer,
        relevant_pests=relevant_pests,
        sources=list(set(sources))[:5],
    )