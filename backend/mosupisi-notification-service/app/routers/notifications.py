from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.models.notification import Notification, NotificationSettings
from app.schemas.notification import (
    NotificationResponse, UnreadCountResponse,
    NotificationSettingsResponse, NotificationSettingsUpdate,
    InternalWeatherAlert,
)
from app.services.notification_store import create_and_deliver

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=list[NotificationResponse])
def get_my_notifications(
    farmer_id: int = Query(...),
    type: Optional[str] = Query(None),
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    q = db.query(Notification).filter(Notification.farmer_id == farmer_id)
    if type:
        q = q.filter(Notification.type == type)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    return q.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    count = db.query(Notification).filter(
        Notification.farmer_id == farmer_id,
        Notification.is_read == False,
    ).count()
    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
def mark_one_read(
    notification_id: int,
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    notif = db.get(Notification, notification_id)
    if not notif or notif.farmer_id != farmer_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    db.refresh(notif)
    return notif


@router.post("/read-all")
def mark_all_read(
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    db.query(Notification).filter(
        Notification.farmer_id == farmer_id,
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/clear-all")
def delete_all_notifications(
    farmer_id: int = Query(...),
    type: Optional[str] = Query(None, description="If provided, only delete this type"),
    db: Session = Depends(get_db),
):
    """Delete all notifications for a farmer, optionally filtered by type.
    Uses /clear-all path to avoid routing conflict with /{notification_id}."""
    q = db.query(Notification).filter(Notification.farmer_id == farmer_id)
    if type:
        q = q.filter(Notification.type == type)
    deleted = q.delete(synchronize_session=False)
    db.commit()
    return {"message": f"Deleted {deleted} notification(s)"}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Delete a single notification. Only the owning farmer can delete it."""
    notif = db.get(Notification, notification_id)
    if not notif or notif.farmer_id != farmer_id:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notif)
    db.commit()
    return {"message": "Notification deleted", "id": notification_id}


@router.get("/settings", response_model=NotificationSettingsResponse)
def get_settings(
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    row = db.query(NotificationSettings).filter(
        NotificationSettings.farmer_id == farmer_id
    ).first()
    if not row:
        row = NotificationSettings(farmer_id=farmer_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.patch("/settings", response_model=NotificationSettingsResponse)
def update_settings(
    payload: NotificationSettingsUpdate,
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    row = db.query(NotificationSettings).filter(
        NotificationSettings.farmer_id == farmer_id
    ).first()
    if not row:
        row = NotificationSettings(farmer_id=farmer_id)
        db.add(row)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row