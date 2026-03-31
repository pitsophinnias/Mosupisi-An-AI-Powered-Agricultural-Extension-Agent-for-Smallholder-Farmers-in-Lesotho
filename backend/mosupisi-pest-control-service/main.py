from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from routes import pests, reports, ask
from rag import PestRAG

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

rag_instance = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag_instance
    logger.info("Initializing Pest Control RAG system...")
    try:
        rag_instance = PestRAG()
        rag_instance.initialize()
        app.state.rag = rag_instance
        logger.info("RAG system initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize RAG: {e}")
        app.state.rag = None
    yield
    logger.info("Shutting down Pest Control Service")


app = FastAPI(
    title="Mosupisi Pest Control Service",
    description="AI-powered pest identification and management for Lesotho farmers",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pests.router, prefix="/api/pests", tags=["pests"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(ask.router, prefix="/api/ask", tags=["ask"])


@app.get("/health")
async def health():
    rag_ready = app.state.rag is not None
    return {
        "status": "healthy",
        "service": "mosupisi-pest-control-service",
        "rag_ready": rag_ready,
    }