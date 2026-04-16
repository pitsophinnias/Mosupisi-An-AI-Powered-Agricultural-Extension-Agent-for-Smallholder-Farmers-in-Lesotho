"""
backend/mosupisi-chat-service/main.py

Python AI service for Mosupisi chat.
Uses mosupisi-q4.gguf (llama-cpp) + ChromaDB RAG, reusing the
planting guide's already-downloaded model and vector store.

Receives from index.js:
  POST /api/chat
  {
    "message": "Should I plant maize this week?",
    "conversation_id": "conv-123",
    "user_id": "user-abc",
    "system_note": "[Weather Context]...",   # from weather service
    "language": "en",
    "context": { "crop": "maize", ... }      # from frontend
  }
"""

import logging
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths — share model + vector store with planting guide service
# ---------------------------------------------------------------------------

SERVICE_DIR  = Path(__file__).parent
PLANTING_DIR = SERVICE_DIR.parent / "mosupisi-planting-guide-service"

MODEL_PATH   = Path(os.getenv(
    "LLAMA_MODEL_PATH",
    str(PLANTING_DIR / "models" / "mosupisi-q4.gguf")
))
CHROMA_DIR   = Path(os.getenv(
    "CHROMA_DIR",
    str(PLANTING_DIR / "chroma_db")
))
EMBEDDER_DIR = Path(os.getenv(
    "EMBEDDER_PATH",
    str(PLANTING_DIR / "models" / "sentence_transformer")
))

# ---------------------------------------------------------------------------
# Lazy singletons — nothing loads at import time
# ---------------------------------------------------------------------------

_llm      = None
_retriever = None


def _get_llm():
    global _llm
    if _llm is not None:
        return _llm
    if not MODEL_PATH.exists():
        logger.warning(f"Model not found at {MODEL_PATH}")
        return None
    try:
        from llama_cpp import Llama
        logger.info(f"Loading LLM: {MODEL_PATH}")
        _llm = Llama(
            model_path   = str(MODEL_PATH),
            n_ctx        = 2048,
            n_threads    = 4,
            n_gpu_layers = 0,
            verbose      = False,
        )
        logger.info("LLM ready")
    except Exception as e:
        logger.error(f"LLM load failed: {e}")
        _llm = None
    return _llm


def _get_retriever():
    global _retriever
    if _retriever is not None:
        return _retriever
    if not CHROMA_DIR.exists():
        logger.warning(f"ChromaDB not found at {CHROMA_DIR}")
        return None
    try:
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        from langchain_chroma import Chroma
        from langchain_huggingface import HuggingFaceEmbeddings

        model_name = str(EMBEDDER_DIR) if EMBEDDER_DIR.exists() else "sentence-transformers/all-MiniLM-L6-v2"
        embeddings = HuggingFaceEmbeddings(
            model_name   = model_name,
            model_kwargs = {"device": "cpu"},
        )
        vs = Chroma(persist_directory=str(CHROMA_DIR), embedding_function=embeddings)
        _retriever = vs.as_retriever(search_kwargs={"k": 4})
        logger.info("RAG retriever ready")
    except Exception as e:
        logger.error(f"Retriever init failed: {e}")
        _retriever = None
    return _retriever


def _retrieve(query: str) -> str:
    r = _get_retriever()
    if r is None:
        return ""
    try:
        docs = r.invoke(query)
        return "\n\n".join(d.page_content for d in docs)
    except Exception as e:
        logger.warning(f"Retrieval error: {e}")
        return ""

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Mosupisi AI Chat Service", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3001,http://localhost:3002"
    ).split(","),
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message:         str
    conversation_id: Optional[str] = None
    user_id:         Optional[str] = None
    system_note:     Optional[str] = None
    language:        Optional[str] = "en"
    context:         Optional[dict] = None


class ChatResponse(BaseModel):
    response:        str
    conversation_id: Optional[str] = None
    sources:         list[str] = []

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

BASE_PERSONA = (
    "You are Mosupisi, a knowledgeable and friendly agricultural assistant "
    "for smallholder farmers in Lesotho. You give practical, specific advice "
    "on crop planting, pest control, soil health, irrigation, and general farming. "
    "Always tailor advice to the highland and lowland conditions of Lesotho. "
    "Be concise and practical."
)


def _build_prompt(message, context_text, system_note, language, crop_ctx):
    parts = [BASE_PERSONA]

    if crop_ctx:
        crop  = crop_ctx.get("crop", "")
        stage = crop_ctx.get("stage", "")
        loc   = crop_ctx.get("location", "")
        if crop:
            parts.append(
                f"\nFarmer context: growing {crop}"
                + (f" at {stage} stage" if stage else "")
                + (f" in {loc}" if loc else "") + "."
            )

    if system_note:
        parts.append(
            "\n" + system_note +
            "\nUse the weather context above when it is relevant to the question."
        )

    if language == "st":
        parts.append("\nAnswer in Sesotho language.")

    system_block = "\n".join(parts)

    rag_block = (
        f"\nRelevant information from Lesotho agricultural bulletins:\n{context_text}\n"
        if context_text else ""
    )

    return (
        f"[INST] {system_block}"
        f"{rag_block}"
        f"\nFarmer question: {message} [/INST]"
    )

# ---------------------------------------------------------------------------
# LLM inference
# ---------------------------------------------------------------------------

async def run_llm(message, system_note, language, crop_ctx, conv_id):
    rag_text = _retrieve(message)
    sources  = ["Lesotho Agricultural Bulletin"] if rag_text else []

    prompt = _build_prompt(message, rag_text, system_note, language, crop_ctx)
    llm    = _get_llm()

    if llm is None:
        return _fallback(message, crop_ctx, language), sources

    try:
        logger.info(f"LLM inference | conv={conv_id} | {message[:50]}")
        out    = llm(
            prompt,
            max_tokens  = 512,
            temperature = 0.4,
            top_p       = 0.9,
            top_k       = 40,
            stop        = ["[INST]", "</s>", "[/INST]"],
        )
        answer = out["choices"][0]["text"].strip()
        return answer or _fallback(message, crop_ctx, language), sources
    except Exception as e:
        logger.error(f"LLM error: {e}")
        return _fallback(message, crop_ctx, language), sources


def _fallback(message, crop_ctx, language):
    crop = (crop_ctx or {}).get("crop", "your crop")
    q    = message.lower()

    rules_en = {
        "fertiliz": f"For {crop}, apply basal fertilizer (2:3:2 + Zn) at planting and top-dress with LAN 4-6 weeks after emergence.",
        "water":    f"Water {crop} during critical stages — flowering and grain/pod filling. Water early morning and check soil moisture 5cm deep before irrigating.",
        "pest":     f"Scout your {crop} weekly. Common pests in Lesotho include stalk borer, armyworm, and aphids. Use IPM and contact your extension officer for pesticides.",
        "plant":    f"Best planting time for {crop} in Lesotho is October to December when rains start. Prepare a good seedbed and plant at the recommended spacing.",
        "harvest":  f"Harvest {crop} when grains are hard and dry (12-15% moisture). Check the forecast and harvest before heavy rains.",
        "disease":  f"For {crop} diseases, remove infected plants, use certified seed, and avoid overhead watering. Contact your extension officer for fungicide options.",
        "weed":     f"Control weeds in {crop} within the first 4-6 weeks after emergence. Hand weed or use registered herbicides.",
        "soil":     f"Lesotho lowland soils are sandy loam; foothills are clay loam. Test your soil and add compost to improve fertility before planting.",
    }
    rules_st = {
        "fertiliz": f"Bakeng sa {crop}, sebelisa manyolo a motheo (2:3:2 + Zn) nakong ea ho jala 'me o eketse LAN libeke tse 4-6 kamora ho mela.",
        "water":    f"Nosetsa {crop} nakong ea bohlokoa — lipalesa le ho tlala ha lithollo. Nosetsa hoseng mme o lekole mongobo oa mobu cm e 5 tlase.",
        "pest":     f"Hlahloba tšimo ea {crop} beke le beke. Likokonyana tse tloaelehileng ke stalk borer, armyworm le aphids. Ikopanye le ofisiri ea temo.",
        "plant":    f"Nako e ntle ea ho jala {crop} Lesotho ke Mphalane ho isa Tšitoe. Lokisa mobu hantle mme u jale ka sebaka se tšoaileng.",
        "harvest":  f"Kotula {crop} ha lithollo li thata (mongobo oa 12-15%). Sheba boemo ba leholimo mme u kotule pele ha lipula tse kholo.",
    }

    rules = rules_st if language == "st" else rules_en
    for kw, advice in rules.items():
        if kw in q:
            return advice

    if language == "st":
        return f"Ke leboha potso ea hau ka {crop}. Ke hloka tlhahisoleseling e eketsehileng — sejalo, nako ea ho jaloa, le mathata ao u a bonang — ho fana ka keletso e tobileng."
    return f"Thank you for your question about {crop}. Please share more details — the crop, when it was planted, and what issue you are seeing — so I can give you specific advice for Lesotho conditions."

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status":     "healthy",
        "service":    "mosupisi-ai-service",
        "model":      str(MODEL_PATH),
        "model_found": MODEL_PATH.exists(),
        "chroma":     str(CHROMA_DIR),
        "chroma_found": CHROMA_DIR.exists(),
        "llm_loaded": _llm is not None,
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    logger.info(
        f"Chat | user={req.user_id} | lang={req.language} | "
        f"weather={'yes' if req.system_note else 'no'} | {req.message[:60]}"
    )

    answer, sources = await run_llm(
        message     = req.message,
        system_note = req.system_note,
        language    = req.language or "en",
        crop_ctx    = req.context,
        conv_id     = req.conversation_id,
    )

    return ChatResponse(
        response        = answer,
        conversation_id = req.conversation_id,
        sources         = sources,
    )