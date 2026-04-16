# routes/plantings.py
# Mosupisi PlantingGuide Microservice — FastAPI route handlers

from __future__ import annotations
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from growth import CROP_ROTATION, get_current_stage, compute_progress, days_since_planting
from rag import get_advice, get_weather_context, get_context, generate_with_slm

router = APIRouter(prefix="/api", tags=["plantings"])


# ---------------------------------------------------------------------------
# 1. GET /plantings
# ---------------------------------------------------------------------------
@router.get("/plantings", response_model=List[schemas.PlantingOut])
def list_plantings(db: Session = Depends(get_db)):
    return crud.get_all_plantings(db)


# ---------------------------------------------------------------------------
# 2. POST /plantings
# ---------------------------------------------------------------------------
@router.post("/plantings", response_model=schemas.PlantingOut, status_code=201)
def create_planting(payload: schemas.PlantingCreate, db: Session = Depends(get_db)):
    return crud.create_planting(db, payload)


# ---------------------------------------------------------------------------
# 3. POST /plantings/{id}/action
#    Logs the activity AND generates advice based on what was done.
# ---------------------------------------------------------------------------
@router.post("/plantings/{planting_id}/action", response_model=schemas.PlantingOut)
def log_action(
    planting_id: int,
    payload: schemas.ActionRequest,
    db: Session = Depends(get_db),
):
    planting = crud.get_planting(db, planting_id)
    if planting is None:
        raise HTTPException(status_code=404, detail=f"Planting {planting_id} not found")

    # Generate action-specific advice
    advice_en, advice_st = _generate_action_advice(
        action   = payload.action,
        crop     = planting.crop,
        stage    = planting.currentStage,
        location = planting.location or "Lesotho",
        language = payload.language,
    )

    updated = crud.log_action(
        db          = db,
        planting_id = planting_id,
        action      = payload.action,
        advice_en   = advice_en,
        advice_st   = advice_st,
        language    = payload.language,
    )
    return updated


# ---------------------------------------------------------------------------
# 4. GET /plantings/{id}/actions
#    Returns the full action log history for a planting.
# ---------------------------------------------------------------------------
@router.get("/plantings/{planting_id}/actions", response_model=List[schemas.ActionLogOut])
def get_action_history(
    planting_id: int,
    db: Session = Depends(get_db),
):
    planting = crud.get_planting(db, planting_id)
    if planting is None:
        raise HTTPException(status_code=404, detail=f"Planting {planting_id} not found")
    return crud.get_action_logs(db, planting_id)


# ---------------------------------------------------------------------------
# 5. POST /plantings/{id}/advice  (full RAG advice)
# ---------------------------------------------------------------------------
@router.post("/plantings/{planting_id}/advice", response_model=schemas.AdviceResponse)
def get_planting_advice(
    planting_id: int,
    payload: schemas.AdviceRequest,
    db: Session = Depends(get_db),
):
    planting = crud.get_planting(db, planting_id)
    if planting is None:
        raise HTTPException(status_code=404, detail=f"Planting {planting_id} not found")

    result = get_advice(
        crop          = planting.crop,
        planting_date = planting.plantingDate,
        area          = planting.area or "unknown area",
        location      = planting.location or "Lesotho",
        current_stage = planting.currentStage,
        days_since    = planting.daysSincePlanting,
        language      = payload.language,
        extra_context = payload.userContext,
    )
    return schemas.AdviceResponse(**result)


# ---------------------------------------------------------------------------
# 6. GET /crop-rotation
# ---------------------------------------------------------------------------
@router.get("/crop-rotation", response_model=schemas.CropRotationResponse)
def crop_rotation():
    return schemas.CropRotationResponse(
        maize   = schemas.RotationEntry(**CROP_ROTATION["maize"]),
        sorghum = schemas.RotationEntry(**CROP_ROTATION["sorghum"]),
        legumes = schemas.RotationEntry(**CROP_ROTATION["legumes"]),
    )


# ---------------------------------------------------------------------------
# 7. GET /weather-context
# ---------------------------------------------------------------------------
@router.get("/weather-context", response_model=schemas.WeatherContextResponse)
def weather_context():
    return schemas.WeatherContextResponse(**get_weather_context())


# ---------------------------------------------------------------------------
# 8. POST /sync
# ---------------------------------------------------------------------------
@router.post("/sync", response_model=schemas.SyncResponse)
def sync_plantings(payload: schemas.SyncRequest, db: Session = Depends(get_db)):
    synced = 0
    for item in payload.plantings:
        crud.upsert_planting_from_sync(db, dict(item))
        synced += 1

    since_dt = datetime.utcnow()
    if payload.lastSyncTimestamp:
        try:
            since_dt = datetime.fromisoformat(
                payload.lastSyncTimestamp.replace("Z", "+00:00")
            ).replace(tzinfo=None)
        except ValueError:
            pass

    delta = crud.get_plantings_since(db, since_dt)
    return schemas.SyncResponse(
        synced    = synced,
        delta     = delta,
        timestamp = datetime.utcnow().isoformat() + "Z",
    )


# ---------------------------------------------------------------------------
# 9. GET /sync/delta
# ---------------------------------------------------------------------------
@router.get("/sync/delta", response_model=schemas.DeltaResponse)
def sync_delta(
    since: str = Query(..., description="ISO 8601 timestamp"),
    db: Session = Depends(get_db),
):
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid 'since' timestamp.")

    delta = crud.get_plantings_since(db, since_dt)
    return schemas.DeltaResponse(
        delta     = delta,
        timestamp = datetime.utcnow().isoformat() + "Z",
    )


# ---------------------------------------------------------------------------
# Internal: generate advice specific to this plant's crop, stage and location
# ---------------------------------------------------------------------------

def _generate_action_advice(
    action: str,
    crop: str,
    stage: str,
    location: str,
    language: str,
) -> tuple[str, str]:
    """
    Generate next-step advice specific to THIS crop at THIS stage in THIS location.
    The prompt is structured so the LLM cannot give generic advice — every key
    variable (crop, stage, location, action) appears multiple times.
    """
    question = f"{crop} {stage} stage {location}: after '{action}', what next and when?"
    context, _ = get_context(question)

    prompt_en = f"""You are Mosupisi, an agricultural advisor for smallholder farmers in Lesotho.

SPECIFIC PLANT DETAILS:
- Crop: {crop}
- Current growth stage: {stage}
- Location: {location}
- Activity just logged: "{action}"

Your task: Give advice ONLY for {crop} at the {stage} stage. Do not give general farming advice.

Answer these three things for {crop} at {stage} stage:
1. Was "{action}" correct at the {stage} stage for {crop}? (one sentence)
2. What should be done NEXT for this {crop}, and WHEN exactly? (be specific: "in 3 days", "next Tuesday morning 6-9am", "in 2 weeks when {crop} reaches next stage")
3. One specific caution for {crop} at {stage} stage in {location}

Bulletin context for {location}:
{context if context else f"Use standard {crop} management for {stage} stage."}

Answer (3-4 sentences, all specific to {crop} at {stage}):"""

    prompt_st = f"""Ke Mosupisi, moeletsi oa temo bakeng sa balimi ba Lesotho.

LINTLHA TSA SEJALO SENA:
- Sejalo: {crop}
- Boemo ba kholo ha joale: {stage}
- Sebaka: {location}
- Ketso e ngoliloe: "{action}"

Mosebetsi oa hau: Fana ka keletso bakeng sa {crop} feela sebakeng sa {stage}. Se arabe ka kakaretso.

Araba lintho tsena tse tharo bakeng sa {crop} sebakeng sa {stage}:
1. Na "{action}" e ne e nepahile nakong ea {stage} bakeng sa {crop}? (mofuta o le mong)
2. Na {crop} ena e lokela ho etsa eng HAJOALE le NENG? (be specific: "ka matsatsi a 3", "Laboraro hosane 6-9am", "ka libeke tse 2")
3. Temoso e le 'ngoe e hlakileng bakeng sa {crop} sebakeng sa {stage} {location}

Karabo (mefuta e 3-4, kaofela e hlakileng bakeng sa {crop} sebakeng sa {stage}):"""

    try:
        advice_en = generate_with_slm(prompt_en)
    except Exception:
        advice_en = _fallback_action_advice(action, crop, stage, "en")

    try:
        advice_st = generate_with_slm(prompt_st)
    except Exception:
        advice_st = _fallback_action_advice(action, crop, stage, "st")

    return advice_en, advice_st


def _fallback_action_advice(action: str, crop: str, stage: str, language: str) -> str:
    """Stage-aware rule-based fallback specific to crop + stage."""
    action_lower = action.lower()

    stage_context_en = {
        "germination": f"At germination, {crop} needs consistent moisture — keep soil damp not wet.",
        "vegetative":  f"During vegetative growth, {crop} needs nitrogen. Top-dress if not done yet.",
        "tasseling":   f"Tasseling is critical for {crop} — any water stress now will cut your yield.",
        "silking":     f"Silking is the most sensitive stage for {crop}. Water every 3 days if no rain.",
        "flowering":   f"During flowering, avoid chemical sprays on {crop} that harm pollination.",
        "grainFill":   f"Grain filling needs adequate moisture. Reduce watering 2 weeks before harvest.",
        "podFill":     f"Pod fill stage — {crop} needs consistent moisture for a good yield.",
        "mature":      f"{crop} is near maturity. Stop watering and prepare harvesting equipment.",
        "boot":        f"Boot stage — {crop} head is forming. Ensure no waterlogging.",
        "heading":     f"Heading stage — protect {crop} from bird damage now.",
    }
    stage_context_st = {
        "germination": f"Nakong ea ho mela, {crop} e hloka kelello — boloka mobu o nang le kelello.",
        "vegetative":  f"Nakong ea kholo, {crop} e hloka naetrojene. Eketsa manyolo ha e sa etsoa.",
        "tasseling":   f"Ho hlaha ha thasete ho bohlokoa — kotsing ea metsi ha joale e tla fokotsea poelo.",
        "silking":     f"Ho hlaha ha silika ke nako e bobebe ka ho fetisisa ho {crop}. Nosetsa ka matsatsi a 3.",
        "flowering":   f"Nakong ea lipalesa, se fifafatse meriana ho {crop} e ka senya li-pollinator.",
        "grainFill":   f"Ho tlala ha lithollo ho hloka kelello. Fokotsa ho nosetsa libeke tse 2 pele ho kotulo.",
        "podFill":     f"Nako ea likhapetla — {crop} e hloka kelello bakeng sa poelo e ntle.",
        "mature":      f"{crop} e haufi le ho butsuoa. Emisa ho nosetsa mme o lokise ho kotula.",
        "boot":        f"Nako ea boot — hlooho ea {crop} e bontsha. Sheba hore ha ho kelello e feteletseng.",
        "heading":     f"Nako ea ho hlaha ha hlooho — sireletsa {crop} khahlanong le linonyana.",
    }

    s_en = stage_context_en.get(stage, f"Continue standard {crop} management at {stage} stage.")
    s_st = stage_context_st.get(stage, f"Tsoela pele ka taolo ea {crop} sebakeng sa {stage}.")

    rules_en = {
        "water":    f"Water again in 3-4 days — check soil moisture first. {s_en}",
        "fertiliz": f"Wait 2-3 weeks before re-applying fertilizer to your {crop}. {s_en}",
        "weed":     f"Check for weed regrowth in 7-10 days. {s_en}",
        "spray":    f"Re-inspect your {crop} in 3 days. Reapply treatment in 7-14 days if needed. {s_en}",
        "plant":    f"Water gently within 24 hours. Check {crop} germination in 7-10 days.",
        "harvest":  f"Dry harvested {crop} in a ventilated area. Store at low humidity. {s_en}",
        "thin":     f"Allow remaining {crop} plants to recover for 2-3 days, then water lightly. {s_en}",
        "prun":     f"Allow {crop} to recover 5-7 days. Water moderately. {s_en}",
    }
    rules_st = {
        "water":    f"Nosetsa hape ka matsatsi a 3-4 — sheba kelello ea mobu pele. {s_st}",
        "fertiliz": f"Letha libeke tse 2-3 pele o sebelisa manyolo hape ho {crop}. {s_st}",
        "weed":     f"Sheba ho hola hape ha lingaka ka matsatsi a 7-10. {s_st}",
        "spray":    f"Hlahloba {crop} ea hao ka matsatsi a 3. Fifafatsa hape ka matsatsi a 7-14. {s_st}",
        "plant":    f"Nosetsa hanyane ka hora tse 24. Sheba ho mela ha {crop} ka matsatsi a 7-10.",
        "harvest":  f"Omisa {crop} sebakeng se nang le moea. Boloka kobong ea leeme. {s_st}",
        "thin":     f"Lumella limela tsa {crop} tse setseng ho fola ka matsatsi a 2-3. {s_st}",
        "prun":     f"Lumella {crop} ho fola ka matsatsi a 5-7. Nosetsa hanyane. {s_st}",
    }

    rules = rules_en if language == "en" else rules_st
    for keyword, advice in rules.items():
        if keyword in action_lower:
            return advice

    if language == "en":
        return f"Activity logged for your {crop} at {stage} stage. {s_en} Monitor every 3-5 days."
    return f"Ketso e ngoliloe bakeng sa {crop} ea hao sebakeng sa {stage}. {s_st} Hlahloba ka matsatsi a 3-5."