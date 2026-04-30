"""
services/aggregator.py - Weather data aggregator.

Source priority:
  Current conditions : CSIS/LMS (official Lesotho govt) → NASA POWER fallback
  Daily forecast     : CSIS/LMS (up to 16 days) → NASA POWER fallback
                       enriched with NASA POWER solar/agro fields
  Agro climate       : NASA POWER only
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import aiosqlite

from models.schemas import (
    AgroClimateData,
    AgroClimateRequest,
    CurrentWeather,
    ForecastRequest,
    WeatherForecast,
    WeatherRequest,
    WeatherSource,
)
from services.nasa_power import NASAPowerClient
from services.lms import LMSClient
from services.openweathermap import OpenWeatherMapClient

logger = logging.getLogger(__name__)

CACHE_TTL_CURRENT_MINUTES  = 30
CACHE_TTL_FORECAST_MINUTES = 60 * 3
CACHE_TTL_AGRO_MINUTES     = 60 * 24


class WeatherAggregator:
    """Aggregates weather from CSIS (primary) and NASA POWER (fallback + enrichment)."""

    def __init__(self, db: aiosqlite.Connection):
        self.db   = db
        self.nasa = NASAPowerClient()
        self.lms  = LMSClient()
        self.owm  = OpenWeatherMapClient()

    async def get_current(self, req: WeatherRequest) -> CurrentWeather:
        """Current conditions from CSIS, NASA POWER fallback."""
        cache_key = f"current:{req.latitude:.4f}:{req.longitude:.4f}"
        cached = await self._get_cache("current", cache_key)
        if cached:
            logger.info(f"Cache hit: {cache_key}")
            return CurrentWeather(**cached)

        result = None

        # 1. Try CSIS (official Lesotho govt data, covers all 13 districts)
        try:
            result = await self.lms.get_current(
                req.latitude, req.longitude, req.location_name
            )
            if result:
                logger.info(f"Current weather from CSIS for {result.location_name}")
        except Exception as e:
            logger.warning(f"CSIS get_current failed: {e} — falling back to NASA POWER")

        # 2. Try OpenWeatherMap (real-time, requires API key in .env)
        if result is None and self.owm.is_active():
            try:
                result = await self.owm.get_current(
                    req.latitude, req.longitude, req.location_name
                )
                if result:
                    logger.info(f"Current weather from OpenWeatherMap for {result.location_name}")
            except Exception as e:
                logger.warning(f"OWM get_current failed: {e} — falling back to NASA POWER")

        # 3. Last resort: NASA POWER (derives current from reanalysis — not real-time)
        if result is None:
            try:
                nasa = await self.nasa.get_forecast(
                    req.latitude, req.longitude, 1, req.location_name
                )
                if nasa and nasa.days:
                    day = nasa.days[-1]
                    result = CurrentWeather(
                        latitude      = req.latitude,
                        longitude     = req.longitude,
                        location_name = req.location_name or "Lesotho",
                        temperature_c = round((day.temp_min_c + day.temp_max_c) / 2, 1),
                        feels_like_c  = None,
                        humidity_pct  = day.humidity_pct or 50.0,
                        wind_speed_ms = day.wind_speed_ms or 0.0,
                        rainfall_mm   = day.rainfall_mm or 0.0,
                        description   = day.description or "Data from NASA POWER",
                        source        = WeatherSource.NASA_POWER,
                    )
                    logger.info("Current weather from NASA POWER (CSIS and OWM unavailable)")
            except Exception as e:
                logger.error(f"NASA POWER fallback also failed: {e}")

        if result is None:
            raise RuntimeError("All weather sources unavailable. Check network connection.")

        await self._set_cache(
            source="current", cache_key=cache_key,
            payload=result.model_dump(mode="json"),
            ttl_minutes=CACHE_TTL_CURRENT_MINUTES,
            latitude=req.latitude, longitude=req.longitude,
        )
        return result

    async def get_forecast(self, req: ForecastRequest) -> WeatherForecast:
        """Multi-day forecast from CSIS, NASA POWER fallback, enriched with solar data."""
        cache_key = f"forecast:{req.latitude:.4f}:{req.longitude:.4f}:d{req.days}"
        cached = await self._get_cache("forecast", cache_key)
        if cached:
            logger.info(f"Cache hit: {cache_key}")
            return WeatherForecast(**cached)

        forecast = None

        # 1. Try CSIS (up to 16 days for all 13 Lesotho towns)
        try:
            forecast = await self.lms.get_forecast(
                req.latitude, req.longitude, req.days, req.location_name
            )
            if forecast:
                logger.info(
                    f"Forecast from CSIS: {len(forecast.days)} days "
                    f"for {forecast.location_name}"
                )
        except Exception as e:
            logger.warning(f"CSIS get_forecast failed: {e} — falling back to NASA POWER")

        # 2. Try OpenWeatherMap (real-time 5-day forecast, requires API key)
        if forecast is None and self.owm.is_active():
            try:
                forecast = await self.owm.get_forecast(
                    req.latitude, req.longitude, req.days, req.location_name
                )
                if forecast:
                    logger.info(f"Forecast from OpenWeatherMap: {len(forecast.days)} days")
            except Exception as e:
                logger.warning(f"OWM forecast failed: {e} — falling back to NASA POWER")

        # 3. Last resort: NASA POWER
        if forecast is None:
            try:
                forecast = await self.nasa.get_forecast(
                    req.latitude, req.longitude, req.days, req.location_name
                )
                logger.info(
                    f"Forecast from NASA POWER (CSIS and OWM unavailable): {len(forecast.days)} days"
                )
            except Exception as e:
                logger.error(f"NASA POWER forecast also failed: {e}")
                raise RuntimeError("All forecast sources unavailable.")

        # 3. Enrich CSIS forecast with NASA POWER solar radiation + farming notes
        if forecast.source != WeatherSource.NASA_POWER:
            try:
                nasa_forecast = await self.nasa.get_forecast(
                    req.latitude, req.longitude, req.days, req.location_name
                )
                forecast = self._merge_forecasts(forecast, nasa_forecast)
            except Exception as e:
                logger.warning(f"NASA POWER enrichment failed, skipping: {e}")

        await self._set_cache(
            source="forecast", cache_key=cache_key,
            payload=forecast.model_dump(mode="json"),
            ttl_minutes=CACHE_TTL_FORECAST_MINUTES,
            latitude=req.latitude, longitude=req.longitude,
        )
        return forecast

    async def get_agro_climate(self, req: AgroClimateRequest) -> AgroClimateData:
        """NASA POWER agrometeorological summary for a date range."""
        cache_key = f"agro:{req.latitude:.4f}:{req.longitude:.4f}:{req.start_date}:{req.end_date}"
        cached = await self._get_cache("nasa_power", cache_key)
        if cached:
            logger.info(f"Cache hit: {cache_key}")
            return AgroClimateData(**cached)

        result = await self.nasa.get_agro_climate(
            req.latitude, req.longitude, req.start_date, req.end_date
        )

        await self._set_cache(
            source="nasa_power", cache_key=cache_key,
            payload=result.model_dump(mode="json"),
            ttl_minutes=CACHE_TTL_AGRO_MINUTES,
            latitude=req.latitude, longitude=req.longitude,
        )
        return result

    def _merge_forecasts(
        self,
        primary: WeatherForecast,
        nasa: Optional[WeatherForecast],
    ) -> WeatherForecast:
        if nasa is None:
            return primary

        nasa_by_date = {d.date: d for d in nasa.days}
        for day in primary.days:
            nasa_day = nasa_by_date.get(day.date)
            if nasa_day:
                day.solar_radiation_mj = nasa_day.solar_radiation_mj
                day.farming_note = nasa_day.farming_note
                if day.rainfall_mm == 0.0 and nasa_day.rainfall_mm:
                    day.rainfall_mm = nasa_day.rainfall_mm

        primary.source = WeatherSource.AGGREGATED
        return primary

    async def _get_cache(self, source: str, cache_key: str) -> Optional[dict]:
        now = datetime.utcnow().isoformat()
        async with self.db.execute(
            "SELECT payload FROM weather_cache WHERE source = ? AND cache_key = ? AND expires_at > ?",
            (source, cache_key, now),
        ) as cursor:
            row = await cursor.fetchone()
        return json.loads(row["payload"]) if row else None

    async def _set_cache(
        self, source: str, cache_key: str, payload: dict,
        ttl_minutes: int, latitude: float, longitude: float,
    ):
        now        = datetime.utcnow()
        expires_at = (now + timedelta(minutes=ttl_minutes)).isoformat()
        await self.db.execute(
            """INSERT OR REPLACE INTO weather_cache
               (source, latitude, longitude, cache_key, payload, fetched_at, expires_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (source, latitude, longitude, cache_key,
             json.dumps(payload, default=str), now.isoformat(), expires_at),
        )
        await self.db.commit()