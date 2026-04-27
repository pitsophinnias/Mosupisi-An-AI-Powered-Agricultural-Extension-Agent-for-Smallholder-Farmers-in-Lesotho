# main.py
# Mosupisi PlantingGuide Microservice - FastAPI application
#
# Run with:
#   uvicorn main:app --port 3001 --reload --reload-exclude ".venv"
#
# Project: Mosupisi - AI Agricultural Extension Agent for Lesotho
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

load_dotenv(dotenv_path=env_path, override=True)

print("LLM_SERVICE_URL loaded:", os.getenv("LLM_SERVICE_URL", "http://localhost:3004"))
# =============================================================================

from database import init_db
from routes.plantings import router as plantings_router
from rag import eager_load


# ---------------------------------------------------------------------------
# Lifespan - runs on startup and shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create SQLite tables and pre-load RAG retriever
    init_db()
    print("Mosupisi PlantingGuide DB initialised (planting.db)")
    print("LLM backend: Local GGUF via mosupisi-llm-service (port 3004)")
    print("Pre-loading RAG retriever to eliminate cold start...")
    eager_load()   # loads sentence transformer + ChromaDB — blocks ~25s on first run
    yield
    # Shutdown: nothing to clean up for SQLite


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Mosupisi PlantingGuide Service",
    description=(
        "AI-powered planting guide microservice for Mosupisi - "
        "the Agricultural Extension Agent for smallholder farmers in Lesotho. "
        "Bilingual (English + Sesotho). Crops: maize, sorghum, legumes."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
        "llm":     "local-gguf (mosupisi-llm-service)",
    }


@app.get("/", tags=["meta"])
def root():
    return {
        "message": "Mosupisi PlantingGuide Service is running. Visit /docs for the API.",
        "lebitso": "Ts'ebeletso ea Mosupisi e a sebetsa. Etela /docs bakeng sa API.",
    }