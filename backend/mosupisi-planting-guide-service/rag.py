import os
import logging

os.environ["HF_HUB_OFFLINE"] = "1"  # use cached model

logger = logging.getLogger(__name__)

# ── Nothing heavy is imported or instantiated at module level ──────────────────
# All ML objects (embeddings, vectorstore, retriever, llm) are created lazily
# on the first request. This lets the server start instantly without needing
# the full model in RAM up front.

_embeddings   = None
_vectorstore  = None
_retriever    = None
_llm          = None


def _get_embeddings():
    global _embeddings
    if _embeddings is not None:
        return _embeddings
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        logger.info("Loading sentence-transformers embeddings...")
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={"device": "cpu"},
        )
        logger.info("Embeddings loaded")
    except Exception as e:
        logger.error(f"Failed to load embeddings: {e}")
        _embeddings = None
    return _embeddings


def _get_retriever():
    global _vectorstore, _retriever
    if _retriever is not None:
        return _retriever
    emb = _get_embeddings()
    if emb is None:
        return None
    try:
        from langchain_chroma import Chroma
        logger.info("Connecting to ChromaDB vector store...")
        _vectorstore = Chroma(
            persist_directory="chroma_db",
            embedding_function=emb,
        )
        _retriever = _vectorstore.as_retriever(search_kwargs={"k": 5})
        logger.info("Vector store ready")
    except Exception as e:
        logger.error(f"Failed to init vector store: {e}")
        _retriever = None
    return _retriever


def _get_llm():
    global _llm
    if _llm is not None:
        return _llm
    model_path = "models/mosupisi-q4.gguf"
    if not os.path.exists(model_path):
        logger.warning(f"LLaMA model not found at {model_path} — using fallback answers")
        return None
    try:
        from llama_cpp import Llama
        logger.info(f"Loading LLaMA model from {model_path}...")
        _llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_threads=4,
            verbose=False,
        )
        logger.info("LLaMA model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load LLaMA model: {e} — using fallback answers")
        _llm = None
    return _llm


# ── Helpers ───────────────────────────────────────────────────────────────────

def generate_with_slm(prompt_text: str) -> str:
    llm = _get_llm()
    if llm is None:
        return (
            "Advisory information is temporarily unavailable. "
            "Please consult your local extension officer or refer to the "
            "Lesotho Meteorological Services Agromet Bulletin for current guidance."
        )
    try:
        output = llm(
            prompt_text,
            max_tokens=512,
            temperature=0.7,
            top_p=0.8,
            top_k=20,
            stop=["<|im_end|>", "<|endoftext|>"],
        )
        return output["choices"][0]["text"].strip()
    except Exception as e:
        logger.error(f"LLM inference failed: {e}")
        return "Could not generate a response at this time. Please try again later."


def get_context(question: str) -> tuple[str, list[str]]:
    """Retrieve relevant chunks from ChromaDB. Returns empty strings if unavailable."""
    retriever = _get_retriever()
    if retriever is None:
        return "", ["Lesotho Meteorological Services Agromet Bulletin"]
    try:
        docs = retriever.invoke(question)
        context = "\n\n".join([doc.page_content for doc in docs])
        sources = list({doc.metadata.get("source", "Agromet Bulletin") for doc in docs})
        return context, sources
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        return "", ["Lesotho Meteorological Services Agromet Bulletin"]


# ── get_advice (used by /plantings/{id}/advice) ───────────────────────────────

def get_advice(
    crop: str,
    planting_date,
    area: str,
    location: str,
    current_stage: str,
    days_since: int,
    language: str = "en",
    extra_context: dict = {},
) -> dict:

    question = (
        f"What advice do you have for a farmer in {location} growing {crop} "
        f"in {area}? The crop was planted {days_since} days ago and is currently "
        f"at the {current_stage} stage."
    )

    context, sources = get_context(question)
    weather_context, _ = get_context(f"Weather outlook for {location}")

    if language == "st":
        prompt = f"""Ke Mosupisi, moeletsi oa temo bakeng sa balimi ba Lesotho.

SEJALO: {crop}
BOEMO HA JOALE: {current_stage}
SEBAKA: {location}
SEBAKA SA TŠIMO: {area}
MATSATSI HO JALWA: {days_since}

Fana ka keletso e hlakileng bakeng sa {crop} FEELA sebakeng sa {current_stage} {location}.
Se arabe ka kakaretso ea temo — bua ka {crop} sebakeng sa {current_stage} feela.

Context:
{context}

Potso: {question}

Karabo (e hlakileng bakeng sa {crop} sebakeng sa {current_stage}):"""
        advice_st = generate_with_slm(prompt)
        advice_en = advice_st

        weather_prompt = f"""Akaretsa boemo ba leea bakeng sa {location} ka Sesotho.
Bua haholo-holo ka hore na leea le amana joang le {crop} sebakeng sa {current_stage}.

Context:
{weather_context}

Kakaretso:"""
        weather_st = generate_with_slm(weather_prompt)
        weather_en = weather_st

    else:
        prompt = f"""You are Mosupisi, an expert agricultural advisor for smallholder farmers in Lesotho.

SPECIFIC PLANT DETAILS:
- Crop: {crop}
- Current growth stage: {current_stage}
- Location: {location}
- Field size: {area}
- Days since planting: {days_since}

Give advice ONLY for {crop} at the {current_stage} stage in {location}.
Do NOT give generic farming advice. Every recommendation must be specific to {crop} at {current_stage}.

Use ONLY the following context from Lesotho Meteorological Services bulletins:
{context}

Question: {question}

Answer (specific to {crop} at {current_stage} stage in {location}):"""
        advice_en = generate_with_slm(prompt)
        advice_st = advice_en

        weather_prompt = f"""Summarize the weather outlook for {location} in English.
Focus on how current weather conditions affect {crop} at the {current_stage} stage.

Context:
{weather_context}

Summary (relevant to {crop} at {current_stage}):"""
        weather_en = generate_with_slm(weather_prompt)
        weather_st = weather_en

    rotation_map = {
        "maize":   {"next": ["legumes", "sorghum"], "reason": "Replenish nitrogen after maize",     "soilPrep": "Add compost, deep plowing",  "soilPrep_st": "Kenya manyolo, lema botebo"},
        "sorghum": {"next": ["legumes", "maize"],   "reason": "Break pest cycles after sorghum",    "soilPrep": "Incorporate crop residue",   "soilPrep_st": "Kenya masalla a lijalo"},
        "legumes": {"next": ["maize", "sorghum"],   "reason": "Legumes fix nitrogen for next crop", "soilPrep": "Minimal tillage",             "soilPrep_st": "Lema hanyane"},
    }
    rotation = rotation_map.get(
        crop.lower(),
        {"next": ["legumes"], "reason": "General rotation", "soilPrep": "Prepare soil", "soilPrep_st": "Lokisa mobu"},
    )

    return {
        "advice_en":               advice_en,
        "advice_st":               advice_st,
        "weather_outlook_en":      weather_en,
        "weather_outlook_st":      weather_st,
        "rotation_recommendation": rotation,
        "sources": sources if sources else ["Lesotho Meteorological Services Agromet Bulletin"],
    }


# ── get_weather_context (used by /weather-context) ────────────────────────────

def get_weather_context() -> dict:
    question = "What is the current rainfall, temperature and weather situation in Lesotho?"
    context, _ = get_context(question)

    def gen(p): return generate_with_slm(p)

    return {
        "bulletin_period":        "Current Dekad",
        "bulletin_number":        "Latest",
        "season":                 "2025/2026",
        "rainfall_summary_en":    gen(f"Summarize the rainfall situation in Lesotho. Be concise.\n\nContext:\n{context}\n\nSummary:"),
        "rainfall_summary_st":    gen(f"Akaretsa boemo ba pula Lesotho. E be khutsoanyane.\n\nContext:\n{context}\n\nKakaretso:"),
        "temperature_summary_en": gen(f"Summarize the temperature situation in Lesotho. Be concise.\n\nContext:\n{context}\n\nSummary:"),
        "temperature_summary_st": gen(f"Akaretsa boemo ba mocheso Lesotho. E be khutsoanyane.\n\nContext:\n{context}\n\nKakaretso:"),
        "outlook_en":             gen(f"Short-term weather outlook for Lesotho in English.\n\nContext:\n{context}\n\nOutlook:"),
        "outlook_st":             gen(f"Boemo ba leea ba nakoana bakeng sa Lesotho ka Sesotho.\n\nContext:\n{context}\n\nBoemo:"),
        "seasonal_outlook_en":    gen(f"Seasonal outlook for Lesotho farmers in English.\n\nContext:\n{context}\n\nSeasonal outlook:"),
        "seasonal_outlook_st":    gen(f"Boemo ba selemo bakeng sa balimi ba Lesotho ka Sesotho.\n\nContext:\n{context}\n\nBoemo ba selemo:"),
        "advisory_en":            gen(f"Main advisory for Lesotho farmers this dekad in English.\n\nContext:\n{context}\n\nAdvisory:"),
        "advisory_st":            gen(f"Keletso e ka sehloohong bakeng sa balimi ba Lesotho ka Sesotho.\n\nContext:\n{context}\n\nKeletso:"),
        "wsi_value":              "N/A",
        "source":                 "Lesotho Meteorological Services Agromet Bulletin",
    }


# ── Quick test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("Testing get_advice...")
    result = get_advice(
        crop="maize",
        planting_date="2026-01-01",
        area="Mohale's Hoek",
        location="Mohale's Hoek",
        current_stage="vegetative",
        days_since=30,
        language="en",
    )
    print("Advice EN:", result["advice_en"])
    print("Sources:", result["sources"])