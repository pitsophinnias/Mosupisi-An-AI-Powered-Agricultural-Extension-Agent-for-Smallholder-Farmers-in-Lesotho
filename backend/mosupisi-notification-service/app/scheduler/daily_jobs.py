import logging
from datetime import datetime, timezone, date

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import SessionLocal
from app.services.crop_calendar import get_due_milestones
from app.services.pest_risk import evaluate_pest_risks
from app.services.notification_store import create_and_deliver

logger = logging.getLogger(__name__)

DISTRICT_COORDS = {
    "Maseru":        (-29.32, 27.50),
    "Leribe":        (-28.88, 28.07),
    "Berea":         (-29.16, 27.74),
    "Mafeteng":      (-29.83, 27.24),
    "Mohale's Hoek": (-30.16, 27.47),
    "Quthing":       (-30.40, 27.70),
    "Qacha's Nek":   (-30.12, 28.68),
    "Mokhotlong":    (-29.31, 29.06),
    "Butha-Buthe":   (-28.76, 28.27),
    "Thaba-Tseka":   (-29.52, 28.61),
}


def _get_db() -> Session:
    return SessionLocal()


async def _get_all_farmers() -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{settings.PROFILE_SERVICE_URL}/internal/farmers/all")
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.error("Failed to fetch farmers: %s", exc)
    return []


async def _get_weather_for_district(district: str) -> dict | None:
    coords = DISTRICT_COORDS.get(district, (-29.32, 27.50))
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{settings.WEATHER_SERVICE_URL}/api/weather/current",
                json={"latitude": coords[0], "longitude": coords[1], "location_name": district},
            )
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.warning("Weather fetch failed for %s: %s", district, exc)
    return None


async def check_planting_reminders():
    logger.info("[Scheduler] Running planting reminder check")
    db = _get_db()
    today = date.today()
    try:
        farmers = await _get_all_farmers()
        for farmer in farmers:
            farmer_id = farmer["id"]
            for farm in farmer.get("farms", []):
                farm_id   = farm["id"]
                farm_name = farm["name"]
                for crop in farm.get("crops", []):
                    crop_id          = crop.get("crop_id", "")
                    planted_date_str = crop.get("planted_date")
                    if not planted_date_str or not crop_id:
                        continue
                    try:
                        planted_date = date.fromisoformat(planted_date_str)
                    except ValueError:
                        continue
                    days_since = (today - planted_date).days
                    if days_since < 0:
                        continue
                    for milestone in get_due_milestones(crop_id, days_since):
                        create_and_deliver(
                            db=db, farmer_id=farmer_id, type="planting",
                            severity="info", title=milestone.title_en,
                            body=milestone.body_en, farm_id=farm_id,
                            farm_name=farm_name, crop_id=crop_id,
                            farmer_phone=None,
                        )
    except Exception as exc:
        logger.error("[Scheduler] Planting reminder error: %s", exc)
    finally:
        db.close()


async def check_pest_risks():
    logger.info("[Scheduler] Running pest risk check")
    db = _get_db()
    try:
        farmers = await _get_all_farmers()
        weather_cache: dict[str, dict] = {}
        for farmer in farmers:
            farmer_id    = farmer["id"]
            farmer_phone = farmer.get("phone_number")
            for farm in farmer.get("farms", []):
                district  = farm.get("district", "Maseru")
                farm_id   = farm["id"]
                farm_name = farm["name"]
                if district not in weather_cache:
                    weather_cache[district] = await _get_weather_for_district(district)
                wx = weather_cache.get(district) or {}
                for crop in farm.get("crops", []):
                    crop_id = crop.get("crop_id", "")
                    if not crop_id:
                        continue
                    for risk in evaluate_pest_risks(
                        crop_id=crop_id,
                        temperature_c=wx.get("temperature_c"),
                        humidity_pct=wx.get("humidity_pct"),
                        rainfall_mm=wx.get("rainfall_mm"),
                        wind_speed_ms=wx.get("wind_speed_ms"),
                    ):
                        phone = farmer_phone if risk.severity == "critical" else None
                        create_and_deliver(
                            db=db, farmer_id=farmer_id, type="pest",
                            severity=risk.severity, title=risk.title_en,
                            body=risk.body_en, farm_id=farm_id,
                            farm_name=farm_name, crop_id=crop_id,
                            farmer_phone=phone,
                        )
    except Exception as exc:
        logger.error("[Scheduler] Pest risk error: %s", exc)
    finally:
        db.close()


async def check_spray_windows():
    logger.info("[Scheduler] Running spray window check")
    db = _get_db()
    try:
        farmers = await _get_all_farmers()
        weather_cache: dict[str, dict] = {}
        for farmer in farmers:
            farmer_id = farmer["id"]
            for farm in farmer.get("farms", []):
                district  = farm.get("district", "Maseru")
                farm_name = farm["name"]
                if district not in weather_cache:
                    weather_cache[district] = await _get_weather_for_district(district)
                wx   = weather_cache.get(district) or {}
                wind = wx.get("wind_speed_ms", 99)
                humid = wx.get("humidity_pct", 99)
                rain  = wx.get("rainfall_mm", 99)
                if (wind is not None and wind <= 5.0
                        and humid is not None and humid <= 85
                        and (rain is None or rain < 5)):
                    create_and_deliver(
                        db=db, farmer_id=farmer_id, type="spray_window",
                        severity="info",
                        title=f"Good Spray Conditions Today — {farm_name}",
                        body=(f"Wind is {wind:.1f} m/s and humidity is {humid:.0f}% at {district}. "
                              "Good conditions for pesticide or fertiliser application. "
                              "Best time: early morning (6–9am) or late afternoon (4–6pm)."),
                        farm_id=farm["id"], farm_name=farm_name,
                        farmer_phone=None,
                    )
    except Exception as exc:
        logger.error("[Scheduler] Spray window error: %s", exc)
    finally:
        db.close()


async def run_all_daily_jobs():
    logger.info("[Scheduler] Starting daily jobs at %s", datetime.now(timezone.utc))
    await check_planting_reminders()
    await check_pest_risks()
    await check_spray_windows()
    logger.info("[Scheduler] Daily jobs complete")