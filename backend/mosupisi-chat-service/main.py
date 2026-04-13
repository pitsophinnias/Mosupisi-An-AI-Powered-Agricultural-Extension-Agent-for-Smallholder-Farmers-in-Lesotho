# backend/mosupisi-chat-service/main.py
# Python AI / RAG service for the Mosupisi chat.
#
# This service receives requests from server.js (the Node gateway).
# The gateway now includes an optional `system_note` field that contains
# live weather context (current conditions + 3-day forecast).
# That note is prepended to the system prompt so the language model
# can give weather-aware farming advice without making its own
# weather API calls.
#
# Request body (from server.js):
#   {
#     "message":         "Should I plant maize this week?",
#     "conversation_id": "conv-1234",
#     "user_id":         "user-abc",
#     "system_note":     "[Current Weather Context]\nLocation: Maseru\n..."   <- new
#   }

import logging
import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Mosupisi AI Service",
    description="RAG-based agricultural assistant for Lesotho farmers.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=(os.getenv("ALLOWED_ORIGINS", "http://localhost:3001")).split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message:         str
    conversation_id: Optional[str] = None
    user_id:         Optional[str] = None
    # NEW: live weather context injected by server.js from the weather service.
    # When present this is prepended to the LLM system prompt so the model
    # can give specific, weather-aware advice.
    system_note:     Optional[str] = None


class ChatResponse(BaseModel):
    response:        str
    conversation_id: Optional[str] = None


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

BASE_SYSTEM_PROMPT = """You are Mosupisi, a knowledgeable and friendly agricultural assistant \
for smallholder farmers in Lesotho. You speak simply and practically. \
You give advice on crop planting, pest control, soil health, irrigation, and general farming. \
Always tailor advice to the highland and lowland conditions of Lesotho."""


def build_system_prompt(system_note: Optional[str]) -> str:
    """
    Combine the base persona with any live weather context supplied by the
    Node gateway. The weather block is inserted after the persona so the
    model treats it as situational context rather than identity.
    """
    if not system_note:
        return BASE_SYSTEM_PROMPT

    return (
        BASE_SYSTEM_PROMPT
        + "\n\n"
        + system_note
        + "\n\nWhen the user's question is related to weather, planting timing, "
        "spraying, or irrigation, use the weather context above to give specific "
        "and actionable advice for their current conditions."
    )


# ---------------------------------------------------------------------------
# RAG / LLM call
# Replace the stub below with your actual RAG pipeline (LangChain, llama-index,
# direct Anthropic/OpenAI call, etc.).
# The key change from the original is: pass `system_prompt` into your LLM call.
# ---------------------------------------------------------------------------

async def run_rag(message: str, system_prompt: str, conversation_id: Optional[str]) -> str:
    """
    Call your RAG pipeline with the composed system prompt.

    Example with direct Anthropic API (replace with your actual implementation):

        import anthropic
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        result = await client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": message}],
        )
        return result.content[0].text

    Example with LangChain:
        chain = build_rag_chain(system_prompt=system_prompt)
        return await chain.ainvoke({"input": message})
    """
    # -------------------------------------------------------------------------
    # STUB — replace this block with your real RAG/LLM implementation
    # -------------------------------------------------------------------------
    logger.info(
        f"[RAG stub] conversation={conversation_id} | "
        f"system_prompt_len={len(system_prompt)} | message={message[:80]}"
    )
    has_weather = "Weather Context" in system_prompt
    weather_note = " (with live weather context)" if has_weather else ""
    return (
        f"[RAG stub{weather_note}] Received: \"{message}\". "
        "Replace run_rag() with your actual LLM/RAG implementation."
    )
    # -------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "mosupisi-ai-service"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Main chat endpoint.

    Accepts an optional `system_note` from the Node gateway that contains
    live weather context. Builds a combined system prompt and passes it to
    the RAG pipeline.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")

    system_prompt = build_system_prompt(req.system_note)

    logger.info(
        f"Chat request | user={req.user_id} | conv={req.conversation_id} | "
        f"weather_context={'yes' if req.system_note else 'no'}"
    )

    try:
        response_text = await run_rag(
            message=req.message,
            system_prompt=system_prompt,
            conversation_id=req.conversation_id,
        )
    except Exception as e:
        logger.error(f"RAG pipeline error: {e}")
        raise HTTPException(status_code=502, detail=f"AI pipeline error: {e}")

    return ChatResponse(
        response=response_text,
        conversation_id=req.conversation_id,
    )