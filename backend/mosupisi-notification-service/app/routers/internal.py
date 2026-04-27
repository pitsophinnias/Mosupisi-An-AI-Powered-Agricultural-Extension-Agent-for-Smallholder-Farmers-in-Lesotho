from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.notification import InternalWeatherAlert
from app.services.notification_store import create_and_deliver

router = APIRouter(prefix="/internal", tags=["internal"])


@router.post("/weather-alert")
def receive_weather_alert(
    payload: InternalWeatherAlert,
    db: Session = Depends(get_db),
):
    notif = create_and_deliver(
        db=db,
        farmer_id=payload.farmer_id,
        type="weather",
        severity=payload.severity,
        title=payload.title,
        body=payload.body,
        farm_id=payload.farm_id,
        farm_name=payload.farm_name,
        farmer_phone=None,
    )
    if notif:
        return {"message": "Alert created", "notification_id": notif.id}
    return {"message": "Alert suppressed"}


@router.post("/run-daily")
async def trigger_daily_jobs():
    from app.scheduler.daily_jobs import run_all_daily_jobs
    await run_all_daily_jobs()
    return {"message": "Daily jobs completed"}