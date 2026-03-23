# routes/plantings.py
# Mosupisi PlantingGuide Microservice – FastAPI route handlers
#
# Endpoints:
#   GET  /api/plantings
#   POST /api/plantings
#   POST /api/plantings/{id}/action
#   POST /api/plantings/{id}/advice
#   GET  /api/crop-rotation
#   GET  /api/weather-context
#   POST /api/sync
#   GET  /api/sync/delta

from __future__ import annotations
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db
from growth import CROP_ROTATION, get_current_stage, compute_progress, days_since_planting
from rag import get_advice, get_weather_context

router = APIRouter(prefix="/api", tags=["plantings"])


# ---------------------------------------------------------------------------
# 1. GET /plantings
# ---------------------------------------------------------------------------
@router.get(
    "/plantings",
    response_model=List[schemas.PlantingOut],
    summary="Return all plantings with computed growth progress and current stage",
)
def list_plantings(db: Session = Depends(get_db)):
    return crud.get_all_plantings(db)


# ---------------------------------------------------------------------------
# 2. POST /plantings
# ---------------------------------------------------------------------------
@router.post(
    "/plantings",
    response_model=schemas.PlantingOut,
    status_code=201,
    summary="Create a new planting record",
)
def create_planting(payload: schemas.PlantingCreate, db: Session = Depends(get_db)):
    return crud.create_planting(db, payload)


# ---------------------------------------------------------------------------
# 3. POST /plantings/{id}/action
# ---------------------------------------------------------------------------
@router.post(
    "/plantings/{planting_id}/action",
    response_model=schemas.PlantingOut,
    summary="Log a farm activity against a planting",
)
def log_action(
    planting_id: int,
    payload: schemas.ActionRequest,
    db: Session = Depends(get_db),
):
    updated = crud.log_action(db, planting_id, payload.action)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Planting {planting_id} not found")
    return updated


# ---------------------------------------------------------------------------
# 4. POST /plantings/{id}/advice  (RAG + LLM)
# ---------------------------------------------------------------------------
@router.post(
    "/plantings/{planting_id}/advice",
    response_model=schemas.AdviceResponse,
    summary="Get AI-powered bilingual planting advice using Agromet Bulletin",
)
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
# 5. GET /crop-rotation
# ---------------------------------------------------------------------------
@router.get(
    "/crop-rotation",
    response_model=schemas.CropRotationResponse,
    summary="Return the crop rotation recommendation table",
)
def crop_rotation():
    return schemas.CropRotationResponse(
        maize   = schemas.RotationEntry(**CROP_ROTATION["maize"]),
        sorghum = schemas.RotationEntry(**CROP_ROTATION["sorghum"]),
        legumes = schemas.RotationEntry(**CROP_ROTATION["legumes"]),
    )


# ---------------------------------------------------------------------------
# 6. GET /weather-context
# ---------------------------------------------------------------------------
@router.get(
    "/weather-context",
    response_model=schemas.WeatherContextResponse,
    summary="Return weather context extracted from the Agromet Bulletin",
)
def weather_context():
    return schemas.WeatherContextResponse(**get_weather_context())


# ---------------------------------------------------------------------------
# 7. POST /sync
# ---------------------------------------------------------------------------
@router.post(
    "/sync",
    response_model=schemas.SyncResponse,
    summary="Upload local plantings and receive server delta",
)
def sync_plantings(payload: schemas.SyncRequest, db: Session = Depends(get_db)):
    synced = 0
    for item in payload.plantings:
        crud.upsert_planting_from_sync(db, dict(item))
        synced += 1

    # Return records newer than the client's last sync timestamp
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
# 8. GET /sync/delta
# ---------------------------------------------------------------------------
@router.get(
    "/sync/delta",
    response_model=schemas.DeltaResponse,
    summary="Return only planting records changed since a given ISO timestamp",
)
def sync_delta(
    since: str = Query(..., description="ISO 8601 timestamp, e.g. 2026-01-01T00:00:00Z"),
    db: Session = Depends(get_db),
):
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="Invalid 'since' timestamp. Use ISO 8601 format, e.g. 2026-01-01T00:00:00Z",
        )

    delta = crud.get_plantings_since(db, since_dt)
    return schemas.DeltaResponse(
        delta     = delta,
        timestamp = datetime.utcnow().isoformat() + "Z",
    )