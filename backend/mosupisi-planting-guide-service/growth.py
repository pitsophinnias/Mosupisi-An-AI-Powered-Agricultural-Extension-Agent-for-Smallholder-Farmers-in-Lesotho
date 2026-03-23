# growth.py
# Mosupisi PlantingGuide Microservice – Crop growth calculations
# Mirrors the JavaScript logic in PlantingGuide.js exactly so that the
# frontend and backend always agree on progress % and current stage.

from __future__ import annotations
from datetime import date, datetime
from typing import Dict, Any

# ---------------------------------------------------------------------------
# Growth stage definitions – match PlantingGuide.js cropGrowthStages
# ---------------------------------------------------------------------------

CROP_GROWTH_STAGES: Dict[str, Dict[str, Dict[str, Any]]] = {
    "maize": {
        "germination": {"days": 7,  "description": "Seed sprouting",        "description_st": "Peo e mela",               "icon": "🌱"},
        "vegetative":  {"days": 45, "description": "Leaf development",      "description_st": "Makhasi a hola",            "icon": "🌿"},
        "tasseling":   {"days": 10, "description": "Tassel emergence",      "description_st": "Lithasete li hlaha",        "icon": "🌽"},
        "silking":     {"days": 10, "description": "Silk emergence",         "description_st": "Silika e hlaha",            "icon": "🌽"},
        "dough":       {"days": 20, "description": "Kernel development",     "description_st": "Lithollo li hlaha",         "icon": "🌽"},
        "dent":        {"days": 15, "description": "Kernel denting",         "description_st": "Lithollo li thatafala",     "icon": "🌽"},
        "mature":      {"days": 10, "description": "Ready for harvest",      "description_st": "E butsoitse",              "icon": "🌾"},
    },
    "sorghum": {
        "germination": {"days": 7,  "description": "Seed sprouting",        "description_st": "Peo e mela",               "icon": "🌱"},
        "vegetative":  {"days": 35, "description": "Leaf development",      "description_st": "Makhasi a hola",            "icon": "🌿"},
        "boot":        {"days": 10, "description": "Head formation",         "description_st": "Hlooho e hlaha",            "icon": "🌾"},
        "heading":     {"days": 7,  "description": "Head emergence",        "description_st": "Hlooho e hlaha",            "icon": "🌾"},
        "flowering":   {"days": 10, "description": "Flowering",             "description_st": "Lipalesa",                  "icon": "🌸"},
        "grainFill":   {"days": 30, "description": "Grain filling",         "description_st": "Lithollo li tlala",         "icon": "🌾"},
        "mature":      {"days": 10, "description": "Ready for harvest",      "description_st": "E butsoitse",              "icon": "🌾"},
    },
    "legumes": {
        "germination": {"days": 7,  "description": "Seed sprouting",        "description_st": "Peo e mela",               "icon": "🌱"},
        "vegetative":  {"days": 30, "description": "Leaf and stem growth",  "description_st": "Makhasi le kutu li hola",  "icon": "🌿"},
        "flowering":   {"days": 15, "description": "Flower development",    "description_st": "Lipalesa",                  "icon": "🌸"},
        "podFill":     {"days": 20, "description": "Pod filling",           "description_st": "Likhapetla li tlala",       "icon": "🫘"},
        "mature":      {"days": 15, "description": "Ready for harvest",      "description_st": "E butsoitse",              "icon": "🫘"},
    },
}

# ---------------------------------------------------------------------------
# Crop rotation table – match PlantingGuide.js cropRotation
# ---------------------------------------------------------------------------

CROP_ROTATION = {
    "maize": {
        "next":        ["legumes", "sorghum"],
        "soilPrep":    "Add nitrogen-fixing crops, apply compost, deep plowing",
        "soilPrep_st": "Kenya lijalo tsa naetrojene, sebelisa manyolo, lema botebo",
        "reason":      "Maize depletes nitrogen. Legumes will restore it.",
    },
    "sorghum": {
        "next":        ["legumes", "maize"],
        "soilPrep":    "Incorporate crop residue, add organic matter",
        "soilPrep_st": "Kenya masalla, eketsa manyolo a tlhaho",
        "reason":      "Sorghum leaves residue that improves soil structure.",
    },
    "legumes": {
        "next":        ["maize", "sorghum"],
        "soilPrep":    "Minimal tillage, retain nodules for nitrogen",
        "soilPrep_st": "Lema hanyane, boloka maqhutsu a naetrojene",
        "reason":      "Legumes fix nitrogen, perfect for heavy feeders like maize.",
    },
}


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _parse_iso_date(date_str: str) -> date | None:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def days_since_planting(planting_date_str: str) -> int:
    d = _parse_iso_date(planting_date_str)
    if d is None:
        return 0
    return max((date.today() - d).days, 0)


def _total_days(crop: str) -> int:
    stages = CROP_GROWTH_STAGES.get(crop, {})
    return sum(s["days"] for s in stages.values())


def compute_progress(crop: str, planting_date_str: str, status: str) -> float:
    """Return growth progress as a percentage (0–100)."""
    if status == "harvested":
        return 100.0
    elapsed    = days_since_planting(planting_date_str)
    total_days = _total_days(crop)
    if total_days == 0:
        return 0.0
    return min((elapsed / total_days) * 100, 99.0)


def get_current_stage(crop: str, planting_date_str: str, status: str) -> str:
    """Return the current named growth stage."""
    if status == "harvested":
        return "harvested"
    elapsed = days_since_planting(planting_date_str)
    stages  = CROP_GROWTH_STAGES.get(crop, {})
    if not stages:
        return "unknown"
    accumulated = 0
    for stage_name, info in stages.items():
        accumulated += info["days"]
        if elapsed <= accumulated:
            return stage_name
    return "mature"


def get_stage_info(crop: str, stage: str) -> Dict[str, Any]:
    stages = CROP_GROWTH_STAGES.get(crop, {})
    return stages.get(stage, {"description": "Growing", "description_st": "E ntse e mela", "icon": "🌱"})