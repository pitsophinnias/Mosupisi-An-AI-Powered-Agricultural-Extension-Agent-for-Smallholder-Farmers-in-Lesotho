from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.notification import PushSubscription
from app.schemas.notification import PushSubscriptionCreate
from app.services.push import generate_vapid_keys
from app.core.config import settings

router = APIRouter(prefix="/push", tags=["push"])


@router.get("/vapid-public-key")
def get_vapid_public_key():
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
def subscribe(
    payload: PushSubscriptionCreate,
    farmer_id: int = Query(...),
    db: Session = Depends(get_db),
):
    existing = db.query(PushSubscription).filter(
        PushSubscription.farmer_id == farmer_id,
        PushSubscription.endpoint == payload.endpoint,
    ).first()
    if existing:
        existing.p256dh = payload.p256dh
        existing.auth = payload.auth
        existing.is_active = True
        db.commit()
        return {"message": "Subscription updated"}
    sub = PushSubscription(
        farmer_id=farmer_id,
        endpoint=payload.endpoint,
        p256dh=payload.p256dh,
        auth=payload.auth,
    )
    db.add(sub)
    db.commit()
    return {"message": "Subscribed to push notifications"}


@router.delete("/subscribe")
def unsubscribe(
    farmer_id: int = Query(...),
    endpoint: str = Query(...),
    db: Session = Depends(get_db),
):
    sub = db.query(PushSubscription).filter(
        PushSubscription.farmer_id == farmer_id,
        PushSubscription.endpoint == endpoint,
    ).first()
    if sub:
        sub.is_active = False
        db.commit()
    return {"message": "Unsubscribed"}


@router.get("/generate-vapid-keys")
def generate_keys():
    return generate_vapid_keys()