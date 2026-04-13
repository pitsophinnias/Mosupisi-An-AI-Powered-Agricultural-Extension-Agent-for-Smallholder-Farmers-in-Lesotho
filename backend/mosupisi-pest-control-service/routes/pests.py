"""
Pest routes - pest library (GET) + pest sighting reports (POST/PATCH/DELETE).
Uses SQLite via SQLAlchemy for reports, and the RAG knowledge base for the library.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from database import get_db, PestReportDB
from schemas import PestReportCreate, PestReportUpdate

router = APIRouter()


# ─── Pest Library ──────────────────────────────────────────────────────────────

@router.get("/")
async def get_all_pests(request: Request, crop: Optional[str] = None):
    """
    Return all pests from the knowledge base.
    Optionally filter by crop name via ?crop=maize
    """
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")

    if crop:
        return rag.get_pests_by_crop(crop)
    return rag.get_all_pests()


@router.get("/crops")
async def get_crops(request: Request):
    """Return the unique list of crops mentioned across all pests."""
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")

    pests = rag.get_all_pests()
    crops = set()
    for pest in pests:
        for crop in pest.get("crops", []):
            crops.add(crop.lower())
    return sorted(list(crops))


@router.get("/tips")
async def get_general_tips(request: Request):
    """Return general prevention tips from the knowledge base."""
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")

    tips_data = rag.get_general_tips()

    # tips_data is a dict like {"crop_rotation": {"en": "...", "st": "..."}, ...}
    # Convert to a list of objects the frontend can render
    tips = []
    for key, value in tips_data.items():
        if isinstance(value, dict):
            tips.append({"key": key, "en": value.get("en", ""), "st": value.get("st", "")})
        else:
            tips.append({"key": key, "en": str(value), "st": str(value)})
    return tips


@router.get("/library/{pest_id}")
async def get_pest_by_id(pest_id: str, request: Request):
    """Return a single pest record by ID."""
    rag = request.app.state.rag
    if not rag:
        raise HTTPException(status_code=503, detail="Service not ready")

    pest = rag.get_pest_by_id(pest_id)
    if not pest:
        raise HTTPException(status_code=404, detail="Pest not found")
    return pest


# ─── Pest Sighting Reports ─────────────────────────────────────────────────────

@router.post("/reports")
async def create_report(report: PestReportCreate, db: Session = Depends(get_db)):
    """Create a new pest sighting report."""
    db_report = PestReportDB(
        id=str(uuid.uuid4()),
        user_id=report.user_id,
        crop=report.crop,
        pest_name=report.pest_name,
        date_observed=str(report.date_observed),
        location=report.location,
        severity=report.severity,
        action_taken=report.action_taken,
        notes=report.notes or "",
        status="monitoring",
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


@router.get("/reports/user/{user_id}")
async def get_user_reports(
    user_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all pest reports for a specific user."""
    query = db.query(PestReportDB).filter(PestReportDB.user_id == user_id)
    if status:
        query = query.filter(PestReportDB.status == status)
    return query.order_by(PestReportDB.created_at.desc()).all()


@router.get("/reports/stats/summary")
async def get_stats(db: Session = Depends(get_db)):
    """Aggregate stats on reported pests (useful for extension officers)."""
    all_reports = db.query(PestReportDB).all()

    pest_counts    = {}
    crop_counts    = {}
    severity_counts = {"low": 0, "medium": 0, "high": 0}

    for r in all_reports:
        pest_counts[r.pest_name]   = pest_counts.get(r.pest_name, 0) + 1
        crop_counts[r.crop]        = crop_counts.get(r.crop, 0) + 1
        severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1

    top_pests = sorted(pest_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_crops = sorted(crop_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_reports":        len(all_reports),
        "top_reported_pests":   [{"pest": k, "count": v} for k, v in top_pests],
        "top_affected_crops":   [{"crop": k, "count": v} for k, v in top_crops],
        "severity_breakdown":   severity_counts,
    }


@router.get("/reports/{report_id}")
async def get_report(report_id: str, db: Session = Depends(get_db)):
    """Get a specific pest report by ID."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.patch("/reports/{report_id}")
async def update_report(
    report_id: str,
    update: PestReportUpdate,
    db: Session = Depends(get_db),
):
    """Update a pest report (e.g. mark as resolved, add notes)."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if update.status is not None:
        report.status = update.status
    if update.action_taken is not None:
        report.action_taken = update.action_taken
    if update.notes is not None:
        report.notes = update.notes

    db.commit()
    db.refresh(report)
    return report


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, db: Session = Depends(get_db)):
    """Delete a pest report."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}