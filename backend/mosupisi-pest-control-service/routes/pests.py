"""
Pest report routes - allows farmers to log, view, and update pest sightings.
Uses SQLite via SQLAlchemy (same approach as planting guide service).
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import uuid

from database import get_db, PestReportDB
from schemas import PestReportCreate, PestReportUpdate

router = APIRouter()


@router.post("/")
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


@router.get("/user/{user_id}")
async def get_user_reports(
    user_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Get all pest reports for a specific user."""
    query = db.query(PestReportDB).filter(PestReportDB.user_id == user_id)
    if status:
        query = query.filter(PestReportDB.status == status)
    reports = query.order_by(PestReportDB.created_at.desc()).all()
    return reports


@router.get("/{report_id}")
async def get_report(report_id: str, db: Session = Depends(get_db)):
    """Get a specific pest report by ID."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.patch("/{report_id}")
async def update_report(
    report_id: str,
    update: PestReportUpdate,
    db: Session = Depends(get_db),
):
    """Update a pest report (e.g., mark as resolved, add notes)."""
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


@router.delete("/{report_id}")
async def delete_report(report_id: str, db: Session = Depends(get_db)):
    """Delete a pest report."""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"message": "Report deleted"}


@router.get("/stats/summary")
async def get_stats(db: Session = Depends(get_db)):
    """Get aggregate stats on reported pests (useful for extension officers)."""
    all_reports = db.query(PestReportDB).all()

    pest_counts = {}
    crop_counts = {}
    severity_counts = {"low": 0, "medium": 0, "high": 0}

    for r in all_reports:
        pest_counts[r.pest_name] = pest_counts.get(r.pest_name, 0) + 1
        crop_counts[r.crop] = crop_counts.get(r.crop, 0) + 1
        severity_counts[r.severity] = severity_counts.get(r.severity, 0) + 1

    top_pests = sorted(pest_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_crops = sorted(crop_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_reports": len(all_reports),
        "top_reported_pests": [{"pest": k, "count": v} for k, v in top_pests],
        "top_affected_crops": [{"crop": k, "count": v} for k, v in top_crops],
        "severity_breakdown": severity_counts,
    }