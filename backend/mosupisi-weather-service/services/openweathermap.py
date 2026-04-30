"""
services/openweathermap.py - OpenWeatherMap API client.

Used as a fallback when CSIS is unavailable.
Provides real-time current conditions and 5-day / 3-hour forecast.

Free tier: 1,000 calls/day, 60 calls/minute.
Sign up at: https://openweathermap.org/api

Set OPENWEATHERMAP_API_KEY in .env to activate.
Leave blank to skip (falls through to NASA POWER).
"""

import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

from models.schemas import (
    CurrentWeather,
    DailyForecast,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

OWM_KEY      = os.getenv("OPENWEATHERMAP_API_KEY", "").strip()
OWM_BASE     = "https://api.openweathermap.org/data/2.5"
TIMEOUT      = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=5.0)

# Map OWM weather condition IDs to human-readable descriptions
def _owm_description(weather_list: list) -> str:
    if not weather_list:
        return "Unknown"
    return weather_list[0].get("description", "Unknown").capitalize()


def _owm_rainfall(rain_dict: dict) -> float:
    """Extract rainfall mm from OWM rain object (1h or 3h key)."""
    if not rain_dict:
        return 0.0
    return float(rain_dict.get("1h", rain_dict.get("3h", 0.0)))


class OpenWeatherMapClient:
    """
    OpenWeatherMap API client.

    Active when OPENWEATHERMAP_API_KEY is set in .env.
    Falls through silently (returns None) when no key is configured.
    """

    def __init__(self):
        self.key = OWM_KEY
        if self.key:
            logger.info("OpenWeatherMap client active (key configured)")
        else:
            logger.info(
                "OpenWeatherMap client inactive — "
                "set OPENWEATHERMAP_API_KEY in .env to enable"
            )

    def is_active(self) -> bool:
        return bool(self.key)

    async def get_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
    ) -> Optional[CurrentWeather]:
        """
        Return current weather from OWM /weather endpoint.
        Returns None if no API key or if request fails.
        """
        if not self.key:
            return None

        url = f"{OWM_BASE}/weather"
        params = {
            "lat":   latitude,
            "lon":   longitude,
            "appid": self.key,
            "units": "metric",
        }

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                d = r.json()

            main    = d.get("main", {})
            wind    = d.get("wind", {})
            rain    = d.get("rain", {})
            weather = d.get("weather", [])

            result = CurrentWeather(
                latitude      = latitude,
                longitude     = longitude,
                location_name = location_name or d.get("name", "Lesotho"),
                temperature_c = round(float(main.get("temp", 20.0)), 1),
                feels_like_c  = round(float(main.get("feels_like", 20.0)), 1),
                humidity_pct  = float(main.get("humidity", 50.0)),
                wind_speed_ms = round(float(wind.get("speed", 0.0)), 1),
                wind_direction_deg = float(wind.get("deg", 0.0)),
                rainfall_mm   = _owm_rainfall(rain),
                cloud_cover_pct = float(d.get("clouds", {}).get("all", 0.0)),
                description   = _owm_description(weather),
                source        = WeatherSource.OPENWEATHERMAP,
            )
            logger.info(
                f"OWM current: {result.temperature_c}°C, "
                f"{result.description} at {result.location_name}"
            )
            return result

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("OWM API key is invalid or not activated yet (401)")
            elif e.response.status_code == 429:
                logger.warning("OWM rate limit exceeded (429) — free tier: 60 calls/min")
            else:
                logger.error(f"OWM HTTP {e.response.status_code}: {e.response.text[:100]}")
            return None
        except Exception as e:
            logger.error(f"OWM get_current failed: {e}")
            return None

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 5,
        location_name: Optional[str] = None,
    ) -> Optional[WeatherForecast]:
        """
        Return daily forecast from OWM /forecast endpoint (5 days, 3-hour steps).
        Aggregates 3-hour slots into daily min/max/rain/humidity/wind.
        Returns None if no API key or if request fails.
        """
        if not self.key:
            return None

        url = f"{OWM_BASE}/forecast"
        params = {
            "lat":   latitude,
            "lon":   longitude,
            "appid": self.key,
            "units": "metric",
            "cnt":   min(days * 8, 40),  # 8 slots per day × days (max 40)
        }

        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                r = await client.get(url, params=params)
                r.raise_for_status()
                d = r.json()

            slots = d.get("list", [])
            if not slots:
                return None

            # Aggregate 3-hour slots into daily entries using CAT dates
            CAT = timezone(timedelta(hours=2))
            daily: dict = {}

            for slot in slots:
                dt_utc  = datetime.fromtimestamp(slot["dt"], tz=timezone.utc)
                date_str = dt_utc.astimezone(CAT).strftime("%Y-%m-%d")

                main    = slot.get("main", {})
                wind    = slot.get("wind", {})
                rain    = slot.get("rain", {})
                weather = slot.get("weather", [])

                temp  = float(main.get("temp", 20.0))
                humid = float(main.get("humidity", 50.0))
                wms   = float(wind.get("speed", 0.0))
                rmm   = _owm_rainfall(rain)
                desc  = _owm_description(weather)

                if date_str not in daily:
                    daily[date_str] = {
                        "temp_min": temp, "temp_max": temp,
                        "humidity": [], "wind": [], "rain": 0.0, "desc": desc,
                    }

                day = daily[date_str]
                day["temp_min"]  = min(day["temp_min"], temp)
                day["temp_max"]  = max(day["temp_max"], temp)
                day["humidity"].append(humid)
                day["wind"].append(wms)
                day["rain"]     += rmm

            today = datetime.now(CAT).strftime("%Y-%m-%d")
            result_days = []
            for date_str in sorted(daily.keys()):
                if date_str < today:
                    continue
                day = daily[date_str]
                result_days.append(DailyForecast(
                    date          = date_str,
                    temp_min_c    = round(day["temp_min"], 1),
                    temp_max_c    = round(day["temp_max"], 1),
                    humidity_pct  = round(sum(day["humidity"]) / len(day["humidity"]), 1),
                    rainfall_mm   = round(day["rain"], 1),
                    wind_speed_ms = round(sum(day["wind"]) / len(day["wind"]), 1),
                    description   = day["desc"],
                ))

            result_days = result_days[:days]
            if not result_days:
                return None

            logger.info(f"OWM forecast: {len(result_days)} days for {location_name or 'Lesotho'}")
            return WeatherForecast(
                latitude      = latitude,
                longitude     = longitude,
                location_name = location_name or d.get("city", {}).get("name", "Lesotho"),
                days          = result_days,
                source        = WeatherSource.OPENWEATHERMAP,
            )

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                logger.error("OWM API key is invalid (401) — check OPENWEATHERMAP_API_KEY in .env")
            elif e.response.status_code == 429:
                logger.warning("OWM rate limit exceeded (429)")
            else:
                logger.error(f"OWM forecast HTTP {e.response.status_code}")
            return None
        except Exception as e:
            logger.error(f"OWM get_forecast failed: {e}")
            return None

    async def health_check(self) -> bool:
        if not self.key:
            return False
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                r = await client.get(
                    f"{OWM_BASE}/weather",
                    params={"lat": -29.32, "lon": 27.50, "appid": self.key, "units": "metric"}
                )
                return r.status_code == 200
        except Exception:
            return False