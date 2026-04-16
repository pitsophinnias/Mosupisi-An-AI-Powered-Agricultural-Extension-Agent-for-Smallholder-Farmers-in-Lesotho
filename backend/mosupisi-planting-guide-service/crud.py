# crud.py
# Mosupisi PlantingGuide Microservice — CRUD operations

from __future__ import annotations
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy.orm import Session

import models
import schemas
from growth import compute_progress, get_current_stage, days_since_planting


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _enrich(planting: models.Planting) -> models.Planting:
    planting.progressPercent   = compute_progress(planting.crop, planting.plantingDate, planting.status)
    planting.currentStage      = get_current_stage(planting.crop, planting.plantingDate, planting.status)
    planting.daysSincePlanting = days_since_planting(planting.plantingDate)
    return planting


# ---------------------------------------------------------------------------
# Planting CRUD
# ---------------------------------------------------------------------------

def get_all_plantings(db: Session) -> List[models.Planting]:
    rows = db.query(models.Planting).order_by(models.Planting.id.desc()).all()
    return [_enrich(r) for r in rows]


def get_planting(db: Session, planting_id: int) -> Optional[models.Planting]:
    row = db.query(models.Planting).filter(models.Planting.id == planting_id).first()
    return _enrich(row) if row else None


def create_planting(db: Session, payload: schemas.PlantingCreate) -> models.Planting:
    data = payload.model_dump(by_alias=True)
    yield_val = data.pop("yield", None)
    obj = models.Planting(**data)
    obj.yield_ = yield_val
    obj.growthStage = get_current_stage(obj.crop, obj.plantingDate, obj.status)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich(obj)


def log_action(
    db: Session,
    planting_id: int,
    action: str,
    advice_en: str = "",
    advice_st: str = "",
    language: str = "en",
) -> Optional[models.Planting]:
    """
    Update the planting's lastAction and persist the action + advice
    to the ActionLog history table.
    """
    obj = db.query(models.Planting).filter(models.Planting.id == planting_id).first()
    if not obj:
        return None

    # Update the planting summary fields
    obj.lastAction     = action
    obj.lastActionDate = date.today().isoformat()
    obj.notes          = action
    obj.updatedAt      = datetime.utcnow()

    # Persist to action log history
    log_entry = models.ActionLog(
        planting_id = planting_id,
        action      = action,
        advice_en   = advice_en,
        advice_st   = advice_st,
        language    = language,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(obj)
    return _enrich(obj)


def get_action_logs(db: Session, planting_id: int) -> List[models.ActionLog]:
    """Return all action log entries for a planting, newest first."""
    return (
        db.query(models.ActionLog)
        .filter(models.ActionLog.planting_id == planting_id)
        .order_by(models.ActionLog.logged_at.desc())
        .all()
    )


def get_plantings_since(db: Session, since: datetime) -> List[models.Planting]:
    rows = (
        db.query(models.Planting)
        .filter(models.Planting.updatedAt >= since)
        .order_by(models.Planting.updatedAt.asc())
        .all()
    )
    return [_enrich(r) for r in rows]


def upsert_planting_from_sync(db: Session, data: dict) -> models.Planting:
    planting_id = data.get("id")
    existing = None
    if planting_id:
        existing = db.query(models.Planting).filter(models.Planting.id == planting_id).first()

    yield_val = data.pop("yield", data.pop("yield_", None))

    if existing:
        for key, value in data.items():
            if hasattr(existing, key) and key not in ("id", "createdAt"):
                setattr(existing, key, value)
        existing.yield_    = yield_val
        existing.updatedAt = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return _enrich(existing)
    else:
        data.pop("id", None)
        data.pop("createdAt", None)
        data.pop("updatedAt", None)
        obj        = models.Planting(**data)
        obj.yield_ = yield_val
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return _enrich(obj)