# main.py
# Mosupisi PlantingGuide Microservice – FastAPI application
#
# Run with:
#   uvicorn main:app --port 3001 --reload
#
# Project: Mosupisi – AI Agricultural Extension Agent for Lesotho
# Bilingual: English + Sesotho | Crops: maize, sorghum, legumes

from __future__ import annotations
import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# ====================== FORCE .env LOADING (Windows fix) ======================
print("Current working directory:", os.getcwd())

env_path = Path(__file__).parent / ".env"
print(".env file path:", env_path)
print(".env file exists?", env_path.exists())

# Load with absolute path + override
load_dotenv(dotenv_path=env_path, override=True)

print("🔑 GROQ_API_KEY loaded:", "✅ YES" if os.getenv("GROQ_API_KEY") else "❌ NO")
print("🔑 OPENAI_API_KEY loaded:", "✅ YES" if os.getenv("OPENAI_API_KEY") else "❌ NO")
# =============================================================================

from database import init_db
from routes.plantings import router as plantings_router


# --------------------------------------------------------------------------- 
# Lifespan (unchanged)
# --------------------------------------------------------------------------- 
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("✅ Mosupisi PlantingGuide DB initialised (planting.db)")
    print("🌽 LLM backend:", "Groq (llama-3-8b-8192)" if os.getenv("GROQ_API_KEY") else "OpenAI" if os.getenv("OPENAI_API_KEY") else "⚠️ No API key")
    yield

# ---------------------------------------------------------------------------
# Lifespan – runs on startup and shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create SQLite tables if they don't exist
    init_db()
    print("✅  Mosupisi PlantingGuide DB initialised (planting.db)")
    print("🌽  LLM backend:", "Groq (llama-3-8b-8192)" if os.getenv("GROQ_API_KEY") else "OpenAI (gpt-3.5-turbo)" if os.getenv("OPENAI_API_KEY") else "⚠️  No API key set – /advice will return fallback")
    yield
    # Shutdown: nothing to clean up for SQLite


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Mosupisi PlantingGuide Service",
    description=(
        "AI-powered planting guide microservice for Mosupisi – "
        "the Agricultural Extension Agent for smallholder farmers in Lesotho. "
        "Bilingual (English + Sesotho). Crops: maize, sorghum, legumes."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS – allow the React dev server and production build
# ---------------------------------------------------------------------------
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
]

# Replace the entire CORS section with this:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # ← temporary for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(plantings_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["meta"])
def health():
    return {
        "status":  "ok",
        "service": "Mosupisi PlantingGuide",
        "version": "1.0.0",
        "llm":     "groq" if os.getenv("GROQ_API_KEY") else "openai" if os.getenv("OPENAI_API_KEY") else "none",
    }


@app.get("/", tags=["meta"])
def root():
    return {
        "message": "Mosupisi PlantingGuide Service is running. Visit /docs for the API.",
        "lebitso": "Ts'ebeletso ea Mosupisi e a sebetsa. Etela /docs bakeng sa API.",
    }