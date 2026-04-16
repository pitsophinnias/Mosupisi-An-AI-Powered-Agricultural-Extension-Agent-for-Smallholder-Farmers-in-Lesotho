"""
services/openweathermap.py - OpenWeatherMap API client (FREE TIER only).

Free tier endpoints used — no credit card required:
  Current weather : api.openweathermap.org/data/2.5/weather    (real-time)
  5-day forecast  : api.openweathermap.org/data/2.5/forecast   (3-hour steps → aggregated to daily)

One Call API 3.0 (previously used for daily forecast) requires a paid plan.
The free /forecast endpoint returns 3-hourly blocks for 5 days which we
aggregate into daily summaries — equivalent information, zero cost.

Free tier limits: 1,000 calls/day, no credit card needed.
Sign up: https://openweathermap.org/api
"""

import logging
import os
from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

import httpx

from models.schemas import (
    CurrentWeather,
    DailyForecast,
    WeatherAlert,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

OWM_BASE     = "https://api.openweathermap.org/data/2.5"
OWM_CURRENT  = f"{OWM_BASE}/weather"   # free — real-time
OWM_FORECAST = f"{OWM_BASE}/forecast"  # free — 5-day / 3-hour


class OpenWeatherMapClient:
    """Async client for the OpenWeatherMap free tier (2.5 API)."""

    def __init__(self):
        self.api_key = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()
        self.timeout = httpx.Timeout(15.0)
        if not self.api_key:
            logger.warning(
                "OPENWEATHERMAP_API_KEY not set — returning mock data. "
                "Get a free key at https://openweathermap.org/api and add it to .env"
            )

    def _is_configured(self) -> bool:
        return bool(self.api_key)

    # ── Current conditions ─────────────────────────────────────────────────

    async def get_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
    ) -> CurrentWeather:
        """Real-time current conditions via GET /data/2.5/weather (free tier)."""
        if not self._is_configured():
            return self._mock_current(latitude, longitude, location_name)

        params = {
            "lat":   latitude,
            "lon":   longitude,
            "appid": self.api_key,
            "units": "metric",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(OWM_CURRENT, params=params)
            response.raise_for_status()
            data = response.json()

        main    = data.get("main", {})
        wind    = data.get("wind", {})
        weather = data.get("weather", [{}])[0]
        rain    = data.get("rain", {})
        clouds  = data.get("clouds", {})

        return CurrentWeather(
            latitude           = latitude,
            longitude          = longitude,
            location_name      = location_name or data.get("name"),
            temperature_c      = round(main.get("temp", 0.0), 1),
            feels_like_c       = round(main.get("feels_like", 0.0), 1),
            humidity_pct       = main.get("humidity", 0.0),
            wind_speed_ms      = round(wind.get("speed", 0.0), 1),
            wind_direction_deg = wind.get("deg"),
            rainfall_mm        = rain.get("1h", 0.0),
            cloud_cover_pct    = clouds.get("all"),
            description        = weather.get("description", "").capitalize(),
            source             = WeatherSource.OPENWEATHERMAP,
        )

    # ── 5-day forecast ─────────────────────────────────────────────────────

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 5,
        location_name: Optional[str] = None,
    ) -> WeatherForecast:
        """
        5-day daily forecast via GET /data/2.5/forecast (free tier).

        OWM returns 3-hourly blocks for 5 days (40 data points).
        We aggregate per day:
          temp_min / temp_max  — min/max across all blocks for the day
          rainfall_mm          — sum of all 3h rain amounts
          wind_speed_ms        — average across the day
          humidity_pct         — average across the day
          description          — from the midday (12:00) block
        """
        # Free tier only goes 5 days — cap silently
        days = min(days, 5)

        if not self._is_configured():
            return self._mock_forecast(latitude, longitude, days, location_name)

        params = {
            "lat":   latitude,
            "lon":   longitude,
            "appid": self.api_key,
            "units": "metric",
            "cnt":   40,   # all available 3-hour blocks
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(OWM_FORECAST, params=params)
            response.raise_for_status()
            data = response.json()

        # Group 3-hourly blocks by date
        by_date: dict[str, list] = defaultdict(list)
        for item in data.get("list", []):
            day_key = item.get("dt_txt", "")[:10]   # "2025-01-15"
            by_date[day_key].append(item)

        daily_forecasts = []
        for day_str in sorted(by_date.keys())[:days]:
            blocks = by_date[day_str]

            temps   = [b["main"]["temp"]     for b in blocks if "main" in b]
            humids  = [b["main"]["humidity"] for b in blocks if "main" in b]
            winds   = [b["wind"]["speed"]    for b in blocks if "wind" in b]
            rain_mm = sum(b.get("rain", {}).get("3h", 0.0) for b in blocks)

            # Use midday block for description; fall back to first block
            midday = next(
                (b for b in blocks if "12:00" in b.get("dt_txt", "")),
                blocks[0],
            )
            desc = midday.get("weather", [{}])[0].get("description", "").capitalize()

            daily_forecasts.append(DailyForecast(
                date          = day_str,
                temp_min_c    = round(min(temps), 1) if temps else 0.0,
                temp_max_c    = round(max(temps), 1) if temps else 0.0,
                humidity_pct  = round(sum(humids) / len(humids), 1) if humids else None,
                rainfall_mm   = round(rain_mm, 1),
                wind_speed_ms = round(sum(winds) / len(winds), 1) if winds else None,
                description   = desc,
            ))

        return WeatherForecast(
            latitude      = latitude,
            longitude     = longitude,
            location_name = location_name or data.get("city", {}).get("name"),
            days          = daily_forecasts,
            source        = WeatherSource.OPENWEATHERMAP,
        )

    # ── Alerts ─────────────────────────────────────────────────────────────

    async def get_alerts(
        self,
        latitude: float,
        longitude: float,
    ) -> list[WeatherAlert]:
        """OWM alerts require One Call 3.0 (paid). Free tier returns empty list."""
        return []

    # ── Health check ───────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        if not self._is_configured():
            return False
        try:
            await self.get_current(-29.3167, 27.4833)
            return True
        except Exception as e:
            logger.warning(f"OWM health check failed: {e}")
            return False

    # ── Mock responses ─────────────────────────────────────────────────────

    def _mock_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str],
    ) -> CurrentWeather:
        logger.info("OWM key not configured — returning mock current weather")
        return CurrentWeather(
            latitude        = latitude,
            longitude       = longitude,
            location_name   = location_name or "Maseru (mock — add API key)",
            temperature_c   = 22.0,
            feels_like_c    = 21.0,
            humidity_pct    = 55.0,
            wind_speed_ms   = 3.5,
            rainfall_mm     = 0.0,
            cloud_cover_pct = 20.0,
            description     = "Partly cloudy (mock — set OPENWEATHERMAP_API_KEY in .env)",
            source          = WeatherSource.OPENWEATHERMAP,
        )

    def _mock_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int,
        location_name: Optional[str],
    ) -> WeatherForecast:
        logger.info("OWM key not configured — returning mock forecast")
        mock_days = []
        for i in range(days):
            d = date.today() + timedelta(days=i)
            mock_days.append(DailyForecast(
                date          = d.isoformat(),
                temp_min_c    = 10.0 + i,
                temp_max_c    = 24.0 + i,
                humidity_pct  = 50.0,
                rainfall_mm   = 2.0 if i % 3 == 0 else 0.0,
                wind_speed_ms = 3.0,
                description   = "Partly cloudy (mock — set OPENWEATHERMAP_API_KEY in .env)",
            ))
        return WeatherForecast(
            latitude      = latitude,
            longitude     = longitude,
            location_name = location_name or "Maseru (mock — add API key)",
            days          = mock_days,
            source        = WeatherSource.OPENWEATHERMAP,
        )