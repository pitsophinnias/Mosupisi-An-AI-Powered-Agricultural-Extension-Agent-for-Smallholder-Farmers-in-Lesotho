"""
Ask route - RAG-powered pest control Q&A.
Retrieves relevant pest knowledge then generates an answer by calling
mosupisi-llm-service (port 3004). No model loaded here.
Falls back to a structured knowledge-base answer if the LLM service
is unavailable.
"""

import logging
import os

import httpx
from fastapi import APIRouter, Request, HTTPException
from schemas import AskRequest, AskResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# LLM service
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:3004")


def _call_llm(prompt: str, language: str) -> str | None:
    """Send a prompt to mosupisi-llm-service and return the text, or None on failure."""
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{LLM_SERVICE_URL}/infer",
                json={
                    "prompt":      prompt,
                    "max_tokens":  512,
                    "temperature": 0.3,
                    "stop":        ["[INST]", "</s>"],
                },
            )
            response.raise_for_status()
            return response.json()["text"]
    except httpx.ConnectError:
        logger.error(
            f"Cannot reach LLM service at {LLM_SERVICE_URL}. "
            "Is mosupisi-llm-service running on port 3004?"
        )
        return None
    except Exception as e:
        logger.error(f"LLM service error: {e}")
        return None


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

    top   = retrieved[0]
    lines = [line.strip() for line in top["text"].split("\n") if line.strip()]
    intro = "Ho latela lintlha tse fumanoang:" if language == "st" else "Based on the available information:"
    return "\n".join([intro] + lines[:8])


def _extract_relevant_pests(retrieved: list, rag) -> list:
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
                "id":              pest["id"],
                "name":            pest["name"],
                "name_st":         pest["name_st"],
                "scientific_name": pest["scientific_name"],
                "crops":           pest["crops"],
                "season":          pest["season"],
                "severity":        pest["severity"],
                "image_emoji":     pest["image_emoji"],
            })
    return results


@router.post("/", response_model=AskResponse)
async def ask_pest_question(request: Request, body: AskRequest):
    """
    Answer a pest control question using RAG + mosupisi-llm-service.
    """
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    search_query = f"{body.crop} {question}" if body.crop else question

    retrieved = rag.retrieve(search_query, n_results=5)

    context_parts = [item["text"] for item in retrieved[:3]]
    context = "\n\n---\n\n".join(context_parts)

    answer = None
    if context:
        prompt = _build_prompt(question, context, body.language)
        answer = _call_llm(prompt, body.language)

    if not answer:
        answer = _fallback_answer(question, retrieved, body.language)

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
        answer         = answer,
        relevant_pests = relevant_pests,
        sources        = list(set(sources))[:5],
    )