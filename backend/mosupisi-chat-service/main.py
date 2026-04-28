# backend/mosupisi-chat-service/main.py
#
# Python AI service for Mosupisi chat.
# Uses ChromaDB RAG (from planting guide) and delegates all LLM inference
# to mosupisi-llm-service (port 3004). No model loaded here.
#
# Routes:
#   POST /api/chat/ask  <- called by index.js gateway
#     { question, language, weatherContext, context, farmer_id }
#   POST /api/chat      <- called by dashboard directly
#     { message, conversation_id, user_id, system_note, language, context }
#   GET  /health        <- checked by index.js /api/health

import logging
import os
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths — share vector store + embeddings with planting guide service
# ---------------------------------------------------------------------------

SERVICE_DIR  = Path(__file__).parent
PLANTING_DIR = SERVICE_DIR.parent / "mosupisi-planting-guide-service"

CHROMA_DIR   = Path(os.getenv(
    "CHROMA_DIR",
    str(PLANTING_DIR / "chroma_db")
))
EMBEDDER_DIR = Path(os.getenv(
    "EMBEDDER_PATH",
    str(PLANTING_DIR / "models" / "sentence_transformer")
))

# LLM service
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:3004")

# ---------------------------------------------------------------------------
# Lazy retriever singleton
# ---------------------------------------------------------------------------

_retriever = None


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
        _retriever = vs.as_retriever(search_kwargs={"k": 2})
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
# LLM service call
# ---------------------------------------------------------------------------

def _call_llm(prompt: str) -> str:
    try:
        with httpx.Client(timeout=110.0) as client:  # 110s < index.js 120s gateway timeout
            response = client.post(
                f"{LLM_SERVICE_URL}/infer",
                json={
                    "prompt":      prompt,
                    "max_tokens":  384,   # chat should be concise; shorter = faster
                    "temperature": 0.4,
                    "stop":        ["[INST]", "</s>", "###"],
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
    except httpx.TimeoutException:
        logger.error(
            f"LLM service timed out after 110s. "
            "The model may still be loading — try again in 30s."
        )
        return None
    except Exception as e:
        logger.error(f"LLM service error: {e}")
        return None

# ---------------------------------------------------------------------------
# App — eager-load retriever on startup to eliminate cold-start latency
# ---------------------------------------------------------------------------

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-load the RAG retriever so the first user message is fast."""
    logger.info("Chat service starting — pre-loading RAG retriever...")
    _get_retriever()   # blocks until sentence transformer is loaded (~25s)
    if _retriever is not None:
        logger.info("RAG retriever ready — chat service warm and ready")
    else:
        logger.warning("RAG retriever not available — will use LLM without context")
    yield
    logger.info("Chat service shutting down")


app = FastAPI(title="Mosupisi AI Chat Service", version="2.0.0", lifespan=lifespan)
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
    # Accept both "message" (original) and "question" (gateway sends this)
    message:         Optional[str] = None
    question:        Optional[str] = None   # alias — gateway sends this field
    conversation_id: Optional[str] = None
    user_id:         Optional[str] = None
    system_note:     Optional[str] = None
    language:        Optional[str] = "en"
    context:         Optional[dict] = None
    farmer_name:     Optional[str] = None   # user's display name from profile


class ChatResponse(BaseModel):
    response:        str
    conversation_id: Optional[str] = None
    sources:         list[str] = []

# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

BASE_PERSONA_EN = (
    "You are Mosupisi, an agricultural assistant for smallholder farmers in Lesotho. "
    "You MUST answer in English only. Do not use any other language. "
    "Give practical, specific advice on crop planting, pest control, soil health, "
    "irrigation, and general farming in Lesotho. Be concise and practical."
)

BASE_PERSONA_ST = (
    "Ke Mosupisi, moeletsi oa temo bakeng sa balimi ba Lesotho. "
    "Araba ka Sesotho feela. "
    "Fana ka keletso e tobileng ka ho jala, likokonyana, mobu le ho nosetsa Lesotho."
)


def _build_prompt(message, context_text, system_note, language, crop_ctx, farmer_name=None):
    persona = BASE_PERSONA_ST if language == "st" else BASE_PERSONA_EN
    parts = [persona]

    # Address the farmer by name if available
    name = farmer_name.strip() if farmer_name and farmer_name.strip() else None
    if name:
        if language == "st":
            parts.append(f"\nLebitso la molemi: {name}. Araba ka lebitso la hae.")
        else:
            parts.append(f"\nThe farmer's name is {name}. Address them by name in your response.")

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

    # Reinforce language at the end of the instruction block
    if language == "st":
        parts.append(
            "\nO LOKELA ho araba ka Sesotho feela. "
            "Ha o arabe ka Senyesemane kapa puo e ngoe le e ngoe. "
            "Sesotho feela. Ho ea pele le ho qetela, araba ka Sesotho."
        )
    else:
        parts.append(
            "\nYou MUST respond in English only. "
            "Do NOT use Chinese, Arabic, French, or any other language. "
            "English only."
        )

    system_block = "\n".join(parts)

    rag_block = (
        f"\nRelevant information from Lesotho agricultural bulletins:\n{context_text}\n"
        if context_text else ""
    )

    farmer_label = name if name else "Farmer"
    return (
        f"[INST] {system_block}"
        f"{rag_block}"
        f"\n{farmer_label}'s question: {message}\nAnswer: [/INST]"
    )

# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------

def _clean_response(text: str, message: str) -> str:
    """Remove prompt artifacts the model echoes back."""
    if not text:
        return text
    import re
    # Strip "Farmer question: ...\n" prefix (model echoes the prompt)
    text = re.sub(r"^Farmer question:[^\n]*\n+", "", text, flags=re.IGNORECASE)
    # Strip "Question: ...\n" prefix
    text = re.sub(r"^Question:[^\n]*\n+", "", text, flags=re.IGNORECASE)
    # Strip leading "Advice:" or "Answer:" label
    text = re.sub(r"^(Advice|Answer)\s*:\s*", "", text, flags=re.IGNORECASE)
    # If model repeated the question verbatim at the start, remove it
    q = message.strip().rstrip("?").lower()
    t = text.strip().lower()
    if t.startswith(q):
        text = text[len(q):].lstrip("? \n\t:")
    return text.strip()


def _is_wrong_language(text: str, expected_language: str) -> bool:
    """
    Detect if the model responded in the wrong language.
    Checks for: Arabic (U+0600-U+06FF), CJK/Japanese/Korean/other (U+2E80+)
    """
    if not text:
        return False
    non_latin = sum(
        1 for c in text
        if ord(c) > 0x2E7F                          # CJK, Japanese, Korean, etc.
        or (0x0600 <= ord(c) <= 0x06FF)             # Arabic
        or (0x0590 <= ord(c) <= 0x05FF)             # Hebrew
        or (0x0900 <= ord(c) <= 0x097F)             # Devanagari
    )
    # If more than 10% of chars are non-Latin, it's the wrong language
    return non_latin > len(text) * 0.1


async def run_llm(message, system_note, language, crop_ctx, conv_id, farmer_name=None):
    rag_text = _retrieve(message)
    sources  = ["Lesotho Agricultural Bulletin"] if rag_text else []

    prompt = _build_prompt(message, rag_text, system_note, language, crop_ctx, farmer_name)

    logger.info(f"Chat inference | conv={conv_id} | {message[:50]}")
    answer = _call_llm(prompt)

    # Strip any prompt artifacts the model echoed back
    if answer:
        answer = _clean_response(answer, message)

    # If the model responded in the wrong language, use the fallback
    if answer and _is_wrong_language(answer, language):
        logger.warning(f"Model responded in wrong language — using fallback. Preview: {answer[:60]!r}")
        answer = None

    if not answer:
        answer = _fallback(message, crop_ctx, language)

    return answer, sources


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
    # Check if LLM service is reachable
    llm_status = "unknown"
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{LLM_SERVICE_URL}/health")
            llm_status = "reachable" if r.status_code == 200 else "error"
    except Exception:
        llm_status = "unreachable"

    return {
        "status":          "healthy",
        "service":         "mosupisi-ai-service",
        "llm_backend":     "mosupisi-llm-service",
        "llm_service_url": LLM_SERVICE_URL,
        "llm_status":      llm_status,
        "chroma":          str(CHROMA_DIR),
        "chroma_found":    CHROMA_DIR.exists(),
    }


# ---------------------------------------------------------------------------
# /api/chat/ask — called by the Node.js gateway (index.js)
# The gateway sends { question, language, weatherContext, context }
# This route maps those fields to the internal ChatRequest format.
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question:       str
    language:       Optional[str] = "en"
    weatherContext: Optional[str] = None   # weather summary string from gateway
    context:        Optional[dict] = None  # crop/stage context
    farmer_id:      Optional[str] = None
    farmer_name:    Optional[str] = None   # user's display name from profile


class AskResponse(BaseModel):
    answer:          str
    sources:         list[str] = []
    conversation_id: Optional[str] = None


@app.post("/api/chat/ask", response_model=AskResponse)
async def chat_ask(req: AskRequest):
    """Entry point called by the Node.js gateway (index.js → POST /api/chat/ask)."""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty")

    logger.info(
        f"Ask | farmer={req.farmer_id} | lang={req.language} | "
        f"weather={'yes' if req.weatherContext else 'no'} | {req.question[:60]}"
    )

    answer, sources = await run_llm(
        message      = req.question,
        system_note  = req.weatherContext,
        language     = req.language or "en",
        crop_ctx     = req.context,
        conv_id      = None,
        farmer_name  = req.farmer_name,
    )

    return AskResponse(answer=answer, sources=sources)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Accept either "message" or "question" field (gateway sends "question")
    text = (req.message or req.question or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="message or question cannot be empty")

    logger.info(
        f"Chat | user={req.user_id} | lang={req.language} | "
        f"weather={'yes' if req.system_note else 'no'} | {text[:60]}"
    )

    answer, sources = await run_llm(
        message      = text,
        system_note  = req.system_note,
        language     = req.language or "en",
        crop_ctx     = req.context,
        conv_id      = req.conversation_id,
        farmer_name  = req.farmer_name,
    )

    return ChatResponse(
        response        = answer,
        conversation_id = req.conversation_id,
        sources         = sources,
    )