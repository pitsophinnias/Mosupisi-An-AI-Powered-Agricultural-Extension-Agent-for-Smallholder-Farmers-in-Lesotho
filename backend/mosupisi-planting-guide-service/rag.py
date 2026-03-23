import os
os.environ["HF_HUB_OFFLINE"] = "1"  #  use cached model
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from llama_cpp import Llama

# ================== EMBEDDINGS & VECTOR STORE ==================
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"}
)

vectorstore = Chroma(
    persist_directory="chroma_db",
    embedding_function=embeddings
)

retriever = vectorstore.as_retriever(search_kwargs={"k": 5})

# ================== LOCAL SLM (GGUF) ==================
llm = Llama(
    model_path="models/mosupisi-q4.gguf",
    n_ctx=2048,
    n_threads=4,
    verbose=False
)

def generate_with_slm(prompt_text: str) -> str:
    output = llm(
        prompt_text,
        max_tokens=512,
        temperature=0.7,
        top_p=0.8,
        top_k=20,
        stop=["<|im_end|>", "<|endoftext|>"]
    )
    return output["choices"][0]["text"].strip()


def get_context(question: str) -> tuple[str, list[str]]:
    """Retrieve relevant chunks and return context text + source list."""
    docs = retriever.invoke(question)
    context = "\n\n".join([doc.page_content for doc in docs])
    sources = list({doc.metadata.get("source", "Agromet Bulletin") for doc in docs})
    return context, sources


# ================== get_advice (used by /plantings/{id}/advice) ==================
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

    # ✅ Only generate in the requested language, mirror for the other
    if language == "st":
        prompt = f"""Ke Mosupisi, moeletsi oa temo bakeng sa balimi ba Lesotho.
Sebelisa feela litlhaloso tse latelang. Fana ka keletso e sebetsang ka Sesotho.

Context:
{context}

Potso: {question}

Karabo:"""
        advice_st = generate_with_slm(prompt)
        advice_en = advice_st  # mirror — frontend shows one based on language

        weather_prompt = f"""Akaretsa boemo ba leea bakeng sa {location} ka Sesotho.

Context:
{weather_context}

Kakaretso:"""
        weather_st = generate_with_slm(weather_prompt)
        weather_en = weather_st

    else:
        prompt = f"""You are Mosupisi, an expert agricultural advisor for smallholder farmers in Lesotho.
Use ONLY the following context from Lesotho Meteorological Services bulletins.
Give practical, actionable advice in English.

Context:
{context}

Question: {question}

Answer:"""
        advice_en = generate_with_slm(prompt)
        advice_st = advice_en  # mirror

        weather_prompt = f"""Summarize the weather outlook for {location} in English. Be concise.

Context:
{weather_context}

Summary:"""
        weather_en = generate_with_slm(weather_prompt)
        weather_st = weather_en

    rotation_map = {
        "maize":   {"next": ["legumes", "sorghum"], "reason": "Replenish nitrogen after maize",    "soilPrep": "Add compost, deep plowing", "soilPrep_st": "Kenya manyolo, lema botebo"},
        "sorghum": {"next": ["legumes", "maize"],   "reason": "Break pest cycles after sorghum",   "soilPrep": "Incorporate crop residue",  "soilPrep_st": "Kenya masalla a lijalo"},
        "legumes": {"next": ["maize", "sorghum"],   "reason": "Legumes fix nitrogen for next crop","soilPrep": "Minimal tillage",            "soilPrep_st": "Lema hanyane"},
    }
    rotation = rotation_map.get(crop.lower(), {"next": ["legumes"], "reason": "General rotation", "soilPrep": "Prepare soil", "soilPrep_st": "Lokisa mobu"})

    return {
        "advice_en":               advice_en,
        "advice_st":               advice_st,
        "weather_outlook_en":      weather_en,
        "weather_outlook_st":      weather_st,
        "rotation_recommendation": rotation,
        "sources": sources if sources else ["Lesotho Meteorological Services Agromet Bulletin"],
    }

# ================== get_weather_context (used by /weather-context) ==================
def get_weather_context() -> dict:
    question = "What is the current rainfall, temperature and weather situation in Lesotho?"
    context, _ = get_context(question)

    def gen(prompt): return generate_with_slm(prompt)

    rainfall_en = gen(f"Summarize the rainfall situation in Lesotho from this bulletin context. Be concise.\n\nContext:\n{context}\n\nSummary:")
    rainfall_st = gen(f"Akaretsa boemo ba pula Lesotho ho tsoa ho context ena. E be khutšoanyane.\n\nContext:\n{context}\n\nKakaretso:")
    temp_en     = gen(f"Summarize the temperature situation in Lesotho from this bulletin context. Be concise.\n\nContext:\n{context}\n\nSummary:")
    temp_st     = gen(f"Akaretsa boemo ba mocheso Lesotho ho tsoa ho context ena. E be khutšoanyane.\n\nContext:\n{context}\n\nKakaretso:")
    outlook_en  = gen(f"What is the short-term weather outlook for Lesotho? Answer in English based on this context.\n\nContext:\n{context}\n\nOutlook:")
    outlook_st  = gen(f"Ke boemo bo feng ba leea ba nakoana bakeng sa Lesotho? Araba ka Sesotho.\n\nContext:\n{context}\n\nBoemo:")
    seasonal_en = gen(f"What is the seasonal outlook for Lesotho farmers? Answer in English.\n\nContext:\n{context}\n\nSeasonal outlook:")
    seasonal_st = gen(f"Ke boemo bo feng ba selemo bakeng sa balimi ba Lesotho? Araba ka Sesotho.\n\nContext:\n{context}\n\nBoemo ba selemo:")
    advisory_en = gen(f"What is the main advisory for Lesotho farmers this dekad? Answer in English.\n\nContext:\n{context}\n\nAdvisory:")
    advisory_st = gen(f"Ke keletso efe e ka sehloohong bakeng sa balimi ba Lesotho dekading ena? Araba ka Sesotho.\n\nContext:\n{context}\n\nKeletso:")

    return {
        "bulletin_period":        "Current Dekad",
        "bulletin_number":        "Latest",
        "season":                 "2025/2026",
        "rainfall_summary_en":    rainfall_en,
        "rainfall_summary_st":    rainfall_st,
        "temperature_summary_en": temp_en,
        "temperature_summary_st": temp_st,
        "outlook_en":             outlook_en,
        "outlook_st":             outlook_st,
        "seasonal_outlook_en":    seasonal_en,
        "seasonal_outlook_st":    seasonal_st,
        "advisory_en":            advisory_en,
        "advisory_st":            advisory_st,
        "wsi_value":              "N/A",
        "source":                 "Lesotho Meteorological Services Agromet Bulletin",
    }


# ================== QUICK TEST ==================
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