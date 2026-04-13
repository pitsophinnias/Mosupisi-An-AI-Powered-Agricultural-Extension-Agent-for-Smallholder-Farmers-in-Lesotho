"""
services/openweathermap.py - OpenWeatherMap API client.

Provides:
  - Current conditions       (real-time, no data lag)
  - 7-day daily forecast     (OWM One Call API 3.0)
  - Severe weather alerts    (from OWM alert payload)

Docs: https://openweathermap.org/api/one-call-3
Requires: OPENWEATHERMAP_API_KEY in .env
"""

import logging
import os
from typing import Optional

import httpx

from models.schemas import (
    AlertSeverity,
    CurrentWeather,
    DailyForecast,
    WeatherAlert,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

OWM_BASE        = "https://api.openweathermap.org/data/3.0/onecall"
OWM_CURRENT_BASE = "https://api.openweathermap.org/data/2.5/weather"


def _severity_from_tags(tags: list[str]) -> AlertSeverity:
    """Map OWM alert event tags to our internal severity levels."""
    tag_str = " ".join(tags).lower()
    if any(w in tag_str for w in ["extreme", "tornado", "hurricane", "blizzard"]):
        return AlertSeverity.CRITICAL
    if any(w in tag_str for w in ["severe", "heavy", "storm", "flood"]):
        return AlertSeverity.SEVERE
    if any(w in tag_str for w in ["warning", "watch", "frost"]):
        return AlertSeverity.WARNING
    return AlertSeverity.INFO


class OpenWeatherMapClient:
    """Async client for the OpenWeatherMap One Call 3.0 API."""

    def __init__(self):
        self.api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")
        self.timeout = httpx.Timeout(15.0)
        if not self.api_key:
            logger.warning(
                "OPENWEATHERMAP_API_KEY not set — OWM endpoints will return mock data"
            )

    def _is_configured(self) -> bool:
        return bool(self.api_key)

    async def get_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
    ) -> CurrentWeather:
        """Fetch real-time current conditions."""
        if not self._is_configured():
            return self._mock_current(latitude, longitude, location_name)

        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": self.api_key,
            "units": "metric",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(OWM_CURRENT_BASE, params=params)
            response.raise_for_status()
            data = response.json()

        main    = data.get("main", {})
        wind    = data.get("wind", {})
        weather = data.get("weather", [{}])[0]
        rain    = data.get("rain", {})

        return CurrentWeather(
            latitude=latitude,
            longitude=longitude,
            location_name=location_name or data.get("name"),
            temperature_c=main.get("temp", 0.0),
            feels_like_c=main.get("feels_like"),
            humidity_pct=main.get("humidity", 0.0),
            wind_speed_ms=wind.get("speed", 0.0),
            wind_direction_deg=wind.get("deg"),
            rainfall_mm=rain.get("1h"),
            cloud_cover_pct=data.get("clouds", {}).get("all"),
            description=weather.get("description", "").capitalize(),
            source=WeatherSource.OPENWEATHERMAP,
        )

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        location_name: Optional[str] = None,
    ) -> WeatherForecast:
        """Fetch daily forecast (up to 8 days from One Call API)."""
        if not self._is_configured():
            return self._mock_forecast(latitude, longitude, days, location_name)

        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": self.api_key,
            "units": "metric",
            "exclude": "current,minutely,hourly,alerts",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(OWM_BASE, params=params)
            response.raise_for_status()
            data = response.json()

        daily_forecasts = []
        for day in data.get("daily", [])[:days]:
            dt_str = _ts_to_date(day.get("dt", 0))
            temp   = day.get("temp", {})
            rain   = day.get("rain", 0.0)
            weather_desc = day.get("weather", [{}])[0].get("description", "").capitalize()

            daily_forecasts.append(DailyForecast(
                date=dt_str,
                temp_min_c=temp.get("min", 0.0),
                temp_max_c=temp.get("max", 0.0),
                humidity_pct=day.get("humidity"),
                rainfall_mm=rain if isinstance(rain, (int, float)) else 0.0,
                wind_speed_ms=day.get("wind_speed"),
                description=weather_desc,
            ))

        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
            days=daily_forecasts,
            source=WeatherSource.OPENWEATHERMAP,
        )

    async def get_alerts(
        self,
        latitude: float,
        longitude: float,
    ) -> list[WeatherAlert]:
        """Fetch any active OWM alerts for the location."""
        if not self._is_configured():
            return []

        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": self.api_key,
            "units": "metric",
            "exclude": "current,minutely,hourly,daily",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(OWM_BASE, params=params)
            response.raise_for_status()
            data = response.json()

        alerts = []
        for raw in data.get("alerts", []):
            tags = raw.get("tags", [])
            alerts.append(WeatherAlert(
                latitude=latitude,
                longitude=longitude,
                severity=_severity_from_tags(tags),
                title=raw.get("event", "Weather Alert"),
                message=raw.get("description", ""),
                source=WeatherSource.OPENWEATHERMAP,
            ))
        return alerts

    async def health_check(self) -> bool:
        """Verify OWM API key is valid."""
        if not self._is_configured():
            return False
        try:
            await self.get_current(-29.3167, 27.4833)
            return True
        except Exception as e:
            logger.warning(f"OWM health check failed: {e}")
            return False

    # ------------------------------------------------------------------
    # Mock responses (returned when API key is not configured)
    # ------------------------------------------------------------------

    def _mock_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str],
    ) -> CurrentWeather:
        logger.info("OWM not configured — returning mock current weather")
        return CurrentWeather(
            latitude=latitude,
            longitude=longitude,
            location_name=location_name or "Mock location",
            temperature_c=22.0,
            feels_like_c=21.0,
            humidity_pct=55.0,
            wind_speed_ms=3.5,
            rainfall_mm=0.0,
            cloud_cover_pct=20.0,
            description="Partly cloudy (mock)",
            source=WeatherSource.OPENWEATHERMAP,
        )

    def _mock_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int,
        location_name: Optional[str],
    ) -> WeatherForecast:
        from datetime import date, timedelta
        logger.info("OWM not configured — returning mock forecast")
        mock_days = []
        for i in range(days):
            d = date.today() + timedelta(days=i)
            mock_days.append(DailyForecast(
                date=d.isoformat(),
                temp_min_c=10.0 + i,
                temp_max_c=24.0 + i,
                humidity_pct=50.0,
                rainfall_mm=2.0 if i % 3 == 0 else 0.0,
                wind_speed_ms=3.0,
                description="Partly cloudy (mock)",
            ))
        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            location_name=location_name or "Mock location",
            days=mock_days,
            source=WeatherSource.OPENWEATHERMAP,
        )


def _ts_to_date(ts: int) -> str:
    """Convert a Unix timestamp to an ISO date string."""
    from datetime import datetime, timezone
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
