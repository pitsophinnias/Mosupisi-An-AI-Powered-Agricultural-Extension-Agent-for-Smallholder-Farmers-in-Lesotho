# backend/mosupisi-llm-service/main.py
#
# Dedicated LLM inference service for Mosupisi.
# Loads mosupisi-q4.gguf ONCE into RAM and serves all other services
# via a simple POST /infer endpoint.
#
# Consumers:
#   mosupisi-planting-guide-service  -> POST /infer
#   mosupisi-chat-service            -> POST /infer
#   mosupisi-pest-control-service    -> POST /infer
#
# Start with:
#   cd backend/mosupisi-llm-service
#   .venv/Scripts/activate
#   uvicorn main:app --host 0.0.0.0 --port 3004 --reload
#
# Ready when you see: "LLM service ready - mosupisi-q4.gguf loaded"

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Env ───────────────────────────────────────────────────────────────────────
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Model path resolution ─────────────────────────────────────────────────────
# Priority:
#   1. LLAMA_MODEL_PATH env var -- only used when non-empty
#   2. mosupisi-planting-guide-service/models/mosupisi-q4.gguf  (primary)
#   3. mosupisi-pest-control-service/models/mosupisi-q4.gguf    (fallback)

SERVICE_DIR = Path(__file__).parent
BACKEND_DIR = SERVICE_DIR.parent

_AUTO_CANDIDATES = [
    BACKEND_DIR / "mosupisi-planting-guide-service" / "models" / "mosupisi-q4.gguf",
    BACKEND_DIR / "mosupisi-pest-control-service"   / "models" / "mosupisi-q4.gguf",
]


def _resolve_model_path() -> Path:
    # Only honour LLAMA_MODEL_PATH if it is actually set to something
    explicit = os.getenv("LLAMA_MODEL_PATH", "").strip()
    if explicit:
        p = Path(explicit)
        if p.exists():
            logger.info(f"Model found at (LLAMA_MODEL_PATH): {p}")
            return p
        raise FileNotFoundError(
            f"LLAMA_MODEL_PATH is set to '{explicit}' but the file does not exist."
        )

    # Auto-resolve from known locations
    for p in _AUTO_CANDIDATES:
        if p.exists():
            logger.info(f"Model found at: {p}")
            return p

    raise FileNotFoundError(
        "mosupisi-q4.gguf not found. Checked:\n"
        + "\n".join(f"  {p}" for p in _AUTO_CANDIDATES)
        + "\nSet LLAMA_MODEL_PATH in .env to an explicit path if the model is elsewhere."
    )


# ── Global LLM singleton ──────────────────────────────────────────────────────
_llm = None


def _load_model():
    global _llm
    from llama_cpp import Llama

    model_path = _resolve_model_path()
    logger.info("Loading GGUF model (this may take 10-30s on first start)...")

    _llm = Llama(
        model_path   = str(model_path),
        n_ctx        = int(os.getenv("LLAMA_N_CTX",     "2048")),
        n_threads    = int(os.getenv("LLAMA_THREADS",   "4")),
        n_gpu_layers = int(os.getenv("LLAMA_GPU_LAYERS","0")),
        verbose      = False,
    )
    logger.info("LLM service ready - mosupisi-q4.gguf loaded")


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_model()
    yield
    logger.info("LLM service shutting down")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "Mosupisi LLM Service",
    description = "Internal inference service - not exposed to the frontend.",
    version     = "1.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:8001"
    ).split(","),
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Schemas ───────────────────────────────────────────────────────────────────

class InferRequest(BaseModel):
    prompt:      str
    max_tokens:  int       = 512
    temperature: float     = 0.4
    stop:        list[str] = ["[INST]", "</s>", "###"]


class InferResponse(BaseModel):
    text:              str
    prompt_tokens:     int
    completion_tokens: int


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/infer", response_model=InferResponse)
async def infer(req: InferRequest):
    if _llm is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty")

    try:
        # Prepend BOS token if not already present.
        # llama-cpp adds <s> automatically when called directly, but not via HTTP.
        # Without it, Mistral Q4 does not reliably recognise [INST]...[/INST] format.
        prompt = req.prompt
        if not prompt.startswith("<s>"):
            prompt = "<s>" + prompt

        output = _llm(
            prompt,
            max_tokens  = req.max_tokens,
            temperature = req.temperature,
            stop        = req.stop,
            echo        = False,
        )
        text  = output["choices"][0]["text"]
        # Strip prompt artifacts the model may leak into its output
        for artifact in ["[/INST]", "[INST]", "</s>", "###", "[/ROLE]", "[OUTCOME]", "[ROLE]"]:
            text = text.replace(artifact, "")
        text = text.strip()
        usage = output.get("usage", {})
        return InferResponse(
            text              = text,
            prompt_tokens     = usage.get("prompt_tokens", 0),
            completion_tokens = usage.get("completion_tokens", 0),
        )
    except Exception as e:
        logger.error(f"Inference error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {e}")


@app.get("/health")
async def health():
    model_path = None
    try:
        model_path = str(_resolve_model_path())
    except FileNotFoundError:
        pass
    return {
        "status":      "healthy" if _llm is not None else "model_not_loaded",
        "service":     "mosupisi-llm-service",
        "llm_loaded":  _llm is not None,
        "model":       "mosupisi-q4.gguf",
        "model_path":  model_path,
        "n_ctx":       int(os.getenv("LLAMA_N_CTX",   "2048")),
        "n_threads":   int(os.getenv("LLAMA_THREADS", "4")),
    }