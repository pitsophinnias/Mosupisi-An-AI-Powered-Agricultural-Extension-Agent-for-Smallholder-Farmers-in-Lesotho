"""
routes/weather.py - Weather forecast and current conditions endpoints.

Endpoints:
  POST /api/weather/current          - Real-time current conditions
  POST /api/weather/forecast         - Multi-day forecast (OWM + NASA enriched)
  POST /api/weather/agro-climate     - NASA POWER agrometeorological summary
  GET  /api/weather/forecast/maseru  - Quick no-auth forecast for Maseru (dev helper)
"""

import logging
from fastapi import APIRouter, Depends, HTTPException

from db.database import get_db
from models.schemas import (
    AgroClimateData,
    AgroClimateRequest,
    CurrentWeather,
    ForecastRequest,
    WeatherForecast,
    WeatherRequest,
)
from services.aggregator import WeatherAggregator

logger = logging.getLogger(__name__)
router = APIRouter()


def _aggregator(db=Depends(get_db)) -> WeatherAggregator:
    return WeatherAggregator(db)


@router.post("/current", response_model=CurrentWeather)
async def get_current_weather(
    req: WeatherRequest,
    agg: WeatherAggregator = Depends(_aggregator),
):
    """
    Return current weather conditions for a given latitude/longitude.

    Sources: OWM (real-time) with LMS fallback.
    Results are cached for 30 minutes in SQLite.
    """
    try:
        return await agg.get_current(req)
    except Exception as e:
        logger.error(f"get_current failed: {e}")
        raise HTTPException(status_code=502, detail=f"Weather data unavailable: {e}")


@router.post("/forecast", response_model=WeatherForecast)
async def get_forecast(
    req: ForecastRequest,
    agg: WeatherAggregator = Depends(_aggregator),
):
    """
    Return a multi-day daily forecast enriched with NASA POWER agro data.

    - Temperature, humidity, wind, rain from OpenWeatherMap
    - Solar radiation + farming notes injected from NASA POWER where dates overlap
    - Results cached for 3 hours in SQLite
    """
    try:
        return await agg.get_forecast(req)
    except Exception as e:
        logger.error(f"get_forecast failed: {e}")
        raise HTTPException(status_code=502, detail=f"Forecast unavailable: {e}")


@router.post("/agro-climate", response_model=AgroClimateData)
async def get_agro_climate(
    req: AgroClimateRequest,
    agg: WeatherAggregator = Depends(_aggregator),
):
    """
    Return a NASA POWER agrometeorological summary for a date range.

    Useful for:
      - Crop suitability analysis
      - Season planning
      - Historical context for RAG responses
      - Extension officer reports

    Results cached for 24 hours.
    """
    try:
        return await agg.get_agro_climate(req)
    except Exception as e:
        logger.error(f"get_agro_climate failed: {e}")
        raise HTTPException(status_code=502, detail=f"Agro climate data unavailable: {e}")


@router.get("/forecast/maseru", response_model=WeatherForecast)
async def get_maseru_forecast(
    days: int = 7,
    agg: WeatherAggregator = Depends(_aggregator),
):
    """
    Development helper — returns a 7-day forecast for Maseru, Lesotho
    without requiring a request body.

    Maseru coordinates: -29.3167°S, 27.4833°E
    """
    req = ForecastRequest(
        latitude=-29.3167,
        longitude=27.4833,
        location_name="Maseru",
        days=days,
    )
    try:
        return await agg.get_forecast(req)
    except Exception as e:
        logger.error(f"Maseru forecast failed: {e}")
        raise HTTPException(status_code=502, detail=f"Forecast unavailable: {e}")
