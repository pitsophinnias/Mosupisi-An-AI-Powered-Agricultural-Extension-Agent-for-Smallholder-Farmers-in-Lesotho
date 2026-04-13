"""
services/aggregator.py - Weather data aggregator.

Merges data from NASA POWER, OpenWeatherMap, and LMS into a single
coherent response. Also handles SQLite caching so repeated requests
for the same location don't hammer the upstream APIs.

Priority / merge logic:
  - Current conditions  : OWM (real-time) → LMS fallback → None
  - Short-term forecast : OWM (true forecast) enriched with NASA POWER
                          solar / agro fields
  - Agro climate data   : NASA POWER only (best historical coverage)
  - Alerts              : OWM alerts + threshold-based alerts from alert_engine
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
from services.openweathermap import OpenWeatherMapClient
from services.lms import LMSClient

logger = logging.getLogger(__name__)

# How long to treat cached data as fresh (in minutes)
CACHE_TTL_CURRENT_MINUTES  = 30
CACHE_TTL_FORECAST_MINUTES = 60 * 3     # 3 hours
CACHE_TTL_AGRO_MINUTES     = 60 * 24    # 24 hours


class WeatherAggregator:
    """Aggregates weather data from all configured sources with SQLite caching."""

    def __init__(self, db: aiosqlite.Connection):
        self.db   = db
        self.nasa = NASAPowerClient()
        self.owm  = OpenWeatherMapClient()
        self.lms  = LMSClient()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def get_current(self, req: WeatherRequest) -> CurrentWeather:
        """Return current conditions — OWM with LMS fallback."""
        cache_key = f"current:{req.latitude:.4f}:{req.longitude:.4f}"
        cached = await self._get_cache("openweathermap", cache_key)
        if cached:
            logger.info(f"Cache hit: {cache_key}")
            return CurrentWeather(**cached)

        # Try LMS first (local authority) — currently always None (stub)
        result = await self.lms.get_current(req.latitude, req.longitude, req.location_name)

        # Fall back to OWM
        if result is None:
            result = await self.owm.get_current(req.latitude, req.longitude, req.location_name)

        await self._set_cache(
            source="openweathermap",
            cache_key=cache_key,
            payload=result.model_dump(mode="json"),
            ttl_minutes=CACHE_TTL_CURRENT_MINUTES,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        return result

    async def get_forecast(self, req: ForecastRequest) -> WeatherForecast:
        """
        Return merged forecast:
          - Daily temperature / rain / wind from OWM (true NWP forecast)
          - Solar radiation + farming notes injected from NASA POWER
        """
        cache_key = f"forecast:{req.latitude:.4f}:{req.longitude:.4f}:d{req.days}"
        cached = await self._get_cache("aggregated", cache_key)
        if cached:
            logger.info(f"Cache hit: {cache_key}")
            return WeatherForecast(**cached)

        # Fetch both sources concurrently where possible
        # (Using sequential calls here — swap to asyncio.gather if latency matters)
        owm_forecast  = await self.owm.get_forecast(req.latitude, req.longitude, req.days, req.location_name)
        nasa_forecast = None
        try:
            nasa_forecast = await self.nasa.get_forecast(req.latitude, req.longitude, req.days, req.location_name)
        except Exception as e:
            logger.warning(f"NASA POWER forecast failed, skipping enrichment: {e}")

        merged = self._merge_forecasts(owm_forecast, nasa_forecast)

        await self._set_cache(
            source="aggregated",
            cache_key=cache_key,
            payload=merged.model_dump(mode="json"),
            ttl_minutes=CACHE_TTL_FORECAST_MINUTES,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        return merged

    async def get_agro_climate(self, req: AgroClimateRequest) -> AgroClimateData:
        """Return NASA POWER agrometeorological summary for a date range."""
        cache_key = f"agro:{req.latitude:.4f}:{req.longitude:.4f}:{req.start_date}:{req.end_date}"
        cached = await self._get_cache("nasa_power", cache_key)
        if cached:
            logger.info(f"Cache hit: {cache_key}")
            return AgroClimateData(**cached)

        result = await self.nasa.get_agro_climate(
            req.latitude, req.longitude, req.start_date, req.end_date
        )

        await self._set_cache(
            source="nasa_power",
            cache_key=cache_key,
            payload=result.model_dump(mode="json"),
            ttl_minutes=CACHE_TTL_AGRO_MINUTES,
            latitude=req.latitude,
            longitude=req.longitude,
        )
        return result

    # ------------------------------------------------------------------
    # Merge logic
    # ------------------------------------------------------------------

    def _merge_forecasts(
        self,
        owm: WeatherForecast,
        nasa: Optional[WeatherForecast],
    ) -> WeatherForecast:
        """
        Enrich OWM forecast days with NASA POWER solar radiation and
        farming notes where dates overlap.
        """
        if nasa is None:
            owm.source = WeatherSource.OPENWEATHERMAP
            return owm

        nasa_by_date = {d.date: d for d in nasa.days}

        for day in owm.days:
            nasa_day = nasa_by_date.get(day.date)
            if nasa_day:
                # Prefer NASA POWER rainfall (corrected / higher quality) if available
                if nasa_day.rainfall_mm is not None:
                    day.rainfall_mm = nasa_day.rainfall_mm
                # Add solar radiation (OWM doesn't provide this)
                day.solar_radiation_mj = nasa_day.solar_radiation_mj
                # Add farming note from NASA POWER analysis
                day.farming_note = nasa_day.farming_note

        owm.source = WeatherSource.AGGREGATED
        return owm

    # ------------------------------------------------------------------
    # SQLite cache helpers
    # ------------------------------------------------------------------

    async def _get_cache(self, source: str, cache_key: str) -> Optional[dict]:
        """Return a cached payload if it exists and has not expired."""
        now = datetime.utcnow().isoformat()
        async with self.db.execute(
            """
            SELECT payload FROM weather_cache
            WHERE source = ? AND cache_key = ? AND expires_at > ?
            """,
            (source, cache_key, now),
        ) as cursor:
            row = await cursor.fetchone()
        if row:
            return json.loads(row["payload"])
        return None

    async def _set_cache(
        self,
        source: str,
        cache_key: str,
        payload: dict,
        ttl_minutes: int,
        latitude: float,
        longitude: float,
    ):
        """Insert or replace a cache entry."""
        now        = datetime.utcnow()
        expires_at = (now + timedelta(minutes=ttl_minutes)).isoformat()
        await self.db.execute(
            """
            INSERT OR REPLACE INTO weather_cache
                (source, latitude, longitude, cache_key, payload, fetched_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source,
                latitude,
                longitude,
                cache_key,
                json.dumps(payload, default=str),
                now.isoformat(),
                expires_at,
            ),
        )
        await self.db.commit()
