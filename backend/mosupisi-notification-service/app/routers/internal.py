# app/routes/internal.py (or wherever POST /internal/weather-alert is defined)
# Internal endpoints — not exposed to the frontend, called by other services.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.notification import Notification
from app.schemas.notification import InternalWeatherAlert
from app.services.notification_store import create_and_deliver

router = APIRouter(prefix="/internal", tags=["internal"])


def _remove_duplicate_alerts(
    db: Session,
    farmer_id: int,
    title: str,
    notification_type: str = "weather",
    keep_latest: int = 1,
) -> int:
    """
    Remove duplicate alerts with the same title, keeping only the most recent one.
    Returns the number of duplicates removed.
    """
    dupes = (
        db.query(Notification)
        .filter(
            Notification.farmer_id == farmer_id,
            Notification.title == title,
            Notification.type == notification_type,
        )
        .order_by(Notification.created_at.desc())
        .offset(keep_latest)  # skip the most recent N, delete the rest
        .all()
    )
    for dupe in dupes:
        db.delete(dupe)
    if dupes:
        db.commit()
    return len(dupes)


def _is_duplicate_alert(
    db: Session,
    farmer_id: int,
    title: str,
    notification_type: str = "weather",
    window_hours: int = 6,
) -> bool:
    """
    Return True if the same alert title was already created for this farmer
    within the last `window_hours` hours.

    Prevents duplicate notifications when:
    - NASA POWER fallback fires multiple times in a session
    - WeatherAlerts.js re-evaluates on page refresh
    - Multiple services send the same alert simultaneously
    """
    cutoff = datetime.utcnow() - timedelta(hours=window_hours)
    existing = db.query(Notification).filter(
        Notification.farmer_id == farmer_id,
        Notification.title == title,
        Notification.type == notification_type,
        Notification.created_at >= cutoff,
    ).first()
    return existing is not None


@router.post("/cleanup-duplicates")
def cleanup_duplicate_notifications(
    farmer_id: int,
    db: Session = Depends(get_db),
):
    """
    One-time cleanup: remove duplicate weather notifications for a farmer.
    Call this once via /docs or curl to fix existing duplicates in the DB.
    """
    from sqlalchemy import func

    # Find titles that appear more than once
    dupes_query = (
        db.query(Notification.title, func.count(Notification.id).label("cnt"))
        .filter(
            Notification.farmer_id == farmer_id,
            Notification.type == "weather",
        )
        .group_by(Notification.title)
        .having(func.count(Notification.id) > 1)
        .all()
    )

    total_removed = 0
    for title, _ in dupes_query:
        removed = _remove_duplicate_alerts(db, farmer_id, title)
        total_removed += removed

    return {"message": f"Cleaned up {total_removed} duplicate notification(s)"}


@router.post("/weather-alert")
async def receive_weather_alert(
    payload: InternalWeatherAlert,
    db: Session = Depends(get_db),
):
    """
    Called by WeatherAlerts.js (via NotificationContext.reportWeatherAlert)
    to create a weather alert notification for a farmer.

    Deduplication: if the same alert title was already sent in the last 6 hours,
    the request is silently dropped to prevent notification spam from:
    - Page refreshes re-triggering alert evaluation
    - NASA POWER fallback firing multiple times per session
    """
    farmer_id = int(payload.farmer_id)

    # Clean up any existing duplicate alerts with the same title
    # (handles duplicates that were stored before dedup was enabled)
    _remove_duplicate_alerts(db, farmer_id, payload.title, notification_type="weather")

    # Dedup check — suppress if same alert already sent in last 6 hours
    if _is_duplicate_alert(db, farmer_id, payload.title, notification_type="weather"):
        return {
            "message": "Duplicate alert suppressed — same alert sent within last 6 hours",
            "skipped": True,
        }

    # Create and deliver the notification
    await create_and_deliver(
        db=db,
        farmer_id=farmer_id,
        notification_type="weather",
        title=payload.title,
        body=payload.body or payload.message or "",
        severity=payload.severity or "warning",
    )

    return {"message": "Alert created and delivered", "skipped": False}