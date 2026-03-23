# crud.py
# Mosupisi PlantingGuide Microservice – CRUD operations
# All business logic for reading/writing plantings lives here so routes stay thin.

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
    """
    Attach computed fields (progressPercent, currentStage, daysSincePlanting)
    to the ORM object so Pydantic can serialise them via PlantingOut.
    """
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
    # map "yield" alias back to the ORM column name yield_
    yield_val = data.pop("yield", None)
    obj = models.Planting(**data)
    obj.yield_ = yield_val
    # derive initial growth stage from crop + planting date
    obj.growthStage = get_current_stage(obj.crop, obj.plantingDate, obj.status)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _enrich(obj)


def log_action(
    db: Session,
    planting_id: int,
    action: str,
) -> Optional[models.Planting]:
    obj = db.query(models.Planting).filter(models.Planting.id == planting_id).first()
    if not obj:
        return None
    obj.lastAction     = action
    obj.lastActionDate = date.today().isoformat()
    obj.notes          = action
    obj.updatedAt      = datetime.utcnow()
    db.commit()
    db.refresh(obj)
    return _enrich(obj)


def get_plantings_since(db: Session, since: datetime) -> List[models.Planting]:
    rows = (
        db.query(models.Planting)
        .filter(models.Planting.updatedAt >= since)
        .order_by(models.Planting.updatedAt.asc())
        .all()
    )
    return [_enrich(r) for r in rows]


def upsert_planting_from_sync(db: Session, data: dict) -> models.Planting:
    """
    Upsert a single planting record coming from the React IndexedDB sync queue.
    If 'id' exists in the DB we update, otherwise we insert.
    """
    planting_id = data.get("id")
    existing = None
    if planting_id:
        existing = db.query(models.Planting).filter(models.Planting.id == planting_id).first()

    yield_val = data.pop("yield", data.pop("yield_", None))

    if existing:
        for key, value in data.items():
            if hasattr(existing, key) and key not in ("id", "createdAt"):
                setattr(existing, key, value)
        existing.yield_     = yield_val
        existing.updatedAt  = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return _enrich(existing)
    else:
        # Remove id so SQLite auto-increments
        data.pop("id", None)
        data.pop("createdAt", None)
        data.pop("updatedAt", None)
        obj        = models.Planting(**data)
        obj.yield_ = yield_val
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return _enrich(obj)