"""
routes/sources.py - Data source status and diagnostics.

Endpoints:
  GET /api/sources/status   - Check all three weather sources (NASA / OWM / LMS)
"""

import logging
from fastapi import APIRouter

from models.schemas import SourceStatus, WeatherSource
from services.nasa_power import NASAPowerClient
from services.openweathermap import OpenWeatherMapClient
from services.lms import LMSClient

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/status", response_model=list[SourceStatus])
async def get_source_status():
    """
    Ping all configured weather sources and return their availability.

    Useful for:
      - Dashboard health widgets
      - Debugging connectivity issues in the field
      - Deciding which source to fall back to
    """
    nasa = NASAPowerClient()
    owm  = OpenWeatherMapClient()
    lms  = LMSClient()

    nasa_ok = await nasa.health_check()
    owm_ok  = await owm.health_check()
    lms_ok  = await lms.health_check()

    return [
        SourceStatus(
            name=WeatherSource.NASA_POWER,
            available=nasa_ok,
            note="Free, no API key required. ~5-7 day data lag (reanalysis).",
        ),
        SourceStatus(
            name=WeatherSource.OPENWEATHERMAP,
            available=owm_ok,
            note=(
                "Requires OPENWEATHERMAP_API_KEY in .env. "
                "Real-time data and 7-day NWP forecast."
                if owm_ok
                else "OPENWEATHERMAP_API_KEY not configured or API unreachable."
            ),
        ),
        SourceStatus(
            name=WeatherSource.LMS,
            available=lms_ok,
            note=(
                "Lesotho Meteorological Services. Currently in STUB mode. "
                "Set LMS_API_URL + LMS_API_KEY + LMS_STUB_MODE=false to activate."
            ),
        ),
    ]
