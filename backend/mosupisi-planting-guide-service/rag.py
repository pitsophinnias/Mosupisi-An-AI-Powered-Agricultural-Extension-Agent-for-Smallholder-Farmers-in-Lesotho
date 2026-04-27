import os
import re
import logging
import httpx
from pathlib import Path

os.environ["HF_HUB_OFFLINE"] = "1"  # use cached model

logger = logging.getLogger(__name__)

# ── Nothing heavy is imported or instantiated at module level ──────────────────
# All ML objects (embeddings, vectorstore, retriever) are created lazily
# on the first request.

_embeddings  = None
_vectorstore = None
_retriever   = None

# ── LLM service URL ───────────────────────────────────────────────────────────
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:3004")


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


# ── LLM inference via dedicated service ───────────────────────────────────────

def generate_with_slm(prompt_text: str, max_tokens: int = 512, temperature: float = 0.4) -> str:
    """Send a prompt to the LLM service and return the generated text."""
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                f"{LLM_SERVICE_URL}/infer",
                json={
                    "prompt":      prompt_text,
                    "max_tokens":  max_tokens,
                    "temperature": temperature,
                    "stop":        ["[INST]", "</s>", "###"],
                },
            )
            response.raise_for_status()
            text = response.json()["text"]
            # Safety cleanup — LLM service already strips these but belt-and-braces
            for artifact in ["[/INST]", "[INST]", "</s>", "###", "[/ROLE]", "[OUTCOME]"]:
                text = text.replace(artifact, "")
            text = text.strip()
            if not text:
                logger.warning(f"LLM service returned empty text for prompt starting: {prompt_text[:80]!r}")
            else:
                logger.info(f"LLM response ({len(text)} chars): {text[:80]!r}")
            return text
    except httpx.ConnectError:
        logger.error(
            f"Cannot reach LLM service at {LLM_SERVICE_URL}. "
            "Is mosupisi-llm-service running on port 3004?"
        )
        return (
            "Advisory information is temporarily unavailable — "
            "the LLM service is not running. "
            "Please start mosupisi-llm-service and try again."
        )
    except Exception as e:
        logger.error(f"LLM service call failed: {e}")
        return (
            "Could not generate advice at this time. "
            "Please try again or contact your local extension officer."
        )


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_context(question: str) -> tuple[str, list[str]]:
    """Retrieve relevant chunks from ChromaDB. Returns empty string if unavailable."""
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


def _detect_repetition(text: str) -> bool:
    """Detect if the model is looping by checking for repeated phrases."""
    words = text.split()
    if len(words) < 10:
        return False
    for i in range(len(words) - 4):
        phrase = " ".join(words[i:i+4])
        if text.count(phrase) > 3:
            return True
    return False


def _translate_to_sesotho(english_text: str) -> str:
    """
    Translate English agricultural advice to Sesotho via the LLM service.
    Uses point-by-point translation to minimise hallucination risk.
    Falls back to English if translation quality is poor.
    """
    if not english_text or not english_text.strip():
        return english_text

    points = re.split(r'(?=\d+\.\s+\*\*)', english_text.strip())
    points = [p.strip() for p in points if p.strip()]

    if len(points) <= 1:
        first_400 = english_text[:400]
        prompt = (
            "[INST] Translate this short farming advice from English to Sesotho (Lesotho). "
            "Write ONLY the translation. Stop after one sentence per point. "
            "Do not repeat any phrase.\n\n"
            f"{first_400}\n\nSesotho: [/INST]"
        )
        result = generate_with_slm(prompt, max_tokens=200, temperature=0.1)
        if _detect_repetition(result) or len(result) > len(first_400) * 2.5:
            return f"[Sesotho translation unavailable]\n\n{english_text}"
        return result

    translated_points = []
    for point in points:
        m = re.match(r'(\d+\.\s+\*\*[^*]+\*\*:?\s*)(.*)', point, re.DOTALL)
        if m:
            prefix = m.group(1)
            body   = m.group(2).strip()[:300]
        else:
            prefix = ""
            body   = point[:300]

        prompt = (
            "[INST] Translate ONLY this one sentence of farming advice to Sesotho (Lesotho). "
            "Write a single short sentence. Do not repeat words. Stop immediately after one sentence.\n\n"
            f"English: {body}\n\nSesotho: [/INST]"
        )
        result = generate_with_slm(prompt, max_tokens=120, temperature=0.1)

        if _detect_repetition(result) or len(result) > len(body) * 3:
            translated_points.append(point)
        else:
            translated_points.append(f"{prefix}{result}" if prefix else result)

    result = "\n\n".join(translated_points)

    if _detect_repetition(result):
        logger.warning("Sesotho translation detected repetition in final output — returning English")
        return english_text

    return result


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

    en_prompt = (
        f"[INST] You are Mosupisi, an expert agricultural advisor for smallholder farmers in Lesotho.\n\n"
        f"SPECIFIC PLANT DETAILS:\n"
        f"- Crop: {crop}\n"
        f"- Current growth stage: {current_stage}\n"
        f"- Location: {location}\n"
        f"- Field size: {area}\n"
        f"- Days since planting: {days_since}\n\n"
        f"Give advice ONLY for {crop} at the {current_stage} stage in {location}.\n"
        f"Do NOT give generic farming advice. Every recommendation must be specific to {crop} at {current_stage}.\n\n"
        f"Use ONLY the following context from Lesotho Meteorological Services bulletins:\n{context}\n\n"
        f"Respond with exactly 4 numbered points. Each point must follow this format:\n"
        f"1. **Point Title**: One or two specific sentences of advice.\n"
        f"2. **Point Title**: One or two specific sentences of advice.\n"
        f"3. **Point Title**: One or two specific sentences of advice.\n"
        f"4. **Point Title**: One or two specific sentences of advice.\n\n"
        f"Answer: [/INST]"
    )

    advice_en = generate_with_slm(en_prompt)

    weather_en_prompt = (
        f"[INST] Summarize the weather outlook for {location} in English.\n"
        f"Focus specifically on how conditions affect {crop} at the {current_stage} stage.\n\n"
        f"Context:\n{weather_context}\n\n"
        f"Respond with 3 numbered points:\n"
        f"1. **Current Conditions**: ...\n"
        f"2. **Rainfall Outlook**: ...\n"
        f"3. **Impact on {crop}**: ...\n\n"
        f"Summary: [/INST]"
    )

    weather_en = generate_with_slm(weather_en_prompt)

    if language == "st":
        advice_st  = _translate_to_sesotho(advice_en)
        weather_st = _translate_to_sesotho(weather_en)
    else:
        advice_st  = advice_en
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

    rainfall_en    = gen(f"[INST] Summarize the rainfall situation in Lesotho in 1-2 sentences. Be concise.\n\nContext:\n{context}\n\nSummary: [/INST]")
    temperature_en = gen(f"[INST] Summarize the temperature situation in Lesotho in 1-2 sentences. Be concise.\n\nContext:\n{context}\n\nSummary: [/INST]")
    outlook_en     = gen(f"[INST] Short-term weather outlook for Lesotho farmers in 1-2 sentences.\n\nContext:\n{context}\n\nOutlook: [/INST]")
    seasonal_en    = gen(f"[INST] Seasonal outlook for Lesotho farmers in 1-2 sentences.\n\nContext:\n{context}\n\nSeasonal outlook: [/INST]")
    advisory_en    = gen(f"[INST] Main farming advisory for Lesotho farmers this period in 1-2 sentences.\n\nContext:\n{context}\n\nAdvisory: [/INST]")

    def tr(text): return _translate_to_sesotho(text)

    return {
        "bulletin_period":        "Current Dekad",
        "bulletin_number":        "Latest",
        "season":                 "2025/2026",
        "rainfall_summary_en":    rainfall_en,
        "rainfall_summary_st":    tr(rainfall_en),
        "temperature_summary_en": temperature_en,
        "temperature_summary_st": tr(temperature_en),
        "outlook_en":             outlook_en,
        "outlook_st":             tr(outlook_en),
        "seasonal_outlook_en":    seasonal_en,
        "seasonal_outlook_st":    tr(seasonal_en),
        "advisory_en":            advisory_en,
        "advisory_st":            tr(advisory_en),
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