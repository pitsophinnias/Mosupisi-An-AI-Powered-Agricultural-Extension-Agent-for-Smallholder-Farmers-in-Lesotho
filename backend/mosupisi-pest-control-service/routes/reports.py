from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from database import get_db, PestReportDB
from schemas import PestReportCreate, PestReportUpdate

router = APIRouter(prefix="/api/reports", tags=["reports"])

@router.post("/", response_model=PestReportResponse)
async def create_report(report: PestReportCreate, db: Session = Depends(get_db)):
    """Log a new pest sighting report"""
    db_report = PestReportDB(
        user_id=report.user_id,
        pest_id=report.pest_id,
        crop_type=report.crop_type,
        severity=report.severity.value,
        location=report.location,
        notes=report.notes,
        photo_url=report.photo_url
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

@router.get("/user/{user_id}", response_model=List[PestReportResponse])
async def get_user_reports(
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get reports for a specific farmer"""
    reports = db.query(PestReportDB)\
        .filter(PestReportDB.user_id == user_id)\
        .offset(skip)\
        .limit(limit)\
        .all()
    return reports

@router.get("/stats/summary")
async def get_report_summary(
    days: int = 30,
    db: Session = Depends(get_db)
):
    """Get aggregate stats for extension officers"""
    since_date = datetime.utcnow() - timedelta(days=days)
    
    reports = db.query(PestReportDB)\
        .filter(PestReportDB.reported_at >= since_date)\
        .all()
    
    # Calculate stats
    total = len(reports)
    by_pest = {}
    by_district = {}
    by_severity = {"low": 0, "medium": 0, "high": 0}
    
    for report in reports:
        by_pest[report.pest_id] = by_pest.get(report.pest_id, 0) + 1
        by_district[report.location] = by_district.get(report.location, 0) + 1
        by_severity[report.severity] += 1
    
    return {
        "total_reports": total,
        "period_days": days,
        "by_pest": by_pest,
        "by_district": by_district,
        "by_severity": by_severity,
        "needs_action": by_severity["high"] > 10  # Alert if many high severity reports
    }

@router.patch("/{report_id}", response_model=PestReportResponse)
async def update_report(
    report_id: int,
    update: PestReportUpdate,
    db: Session = Depends(get_db)
):
    """Update report status (for extension officers)"""
    report = db.query(PestReportDB).filter(PestReportDB.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if update.status:
        report.status = update.status
    if update.officer_notes:
        report.officer_notes = update.officer_notes
    
    db.commit()
    db.refresh(report)
    return report