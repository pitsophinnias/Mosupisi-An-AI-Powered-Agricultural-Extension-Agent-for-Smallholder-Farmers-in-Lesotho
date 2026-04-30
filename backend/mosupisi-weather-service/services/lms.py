"""
services/lms.py - CSIS Lesotho Forecast API client.

Fetches official weather forecasts from the Centre for Scientific and
Industrial Research (CSIS) Lesotho portal, which publishes forecasts
for 13 towns across all districts of Lesotho.

API endpoint : https://share.csis.gov.ls/api/forecasts
Auth         : None required (public endpoint)
Coverage     : 13 towns, ~16 days of forecast data
Update freq  : Daily

Data structure:
  - Array of FeatureCollections, one per time period
  - effective_period_time "00:00:00" = midnight snapshot (current conditions)
  - effective_period_time "00:01:00" = whole-day forecast
  - Each FeatureCollection has features for all 13 towns

Fields available per town per period:
  city, city_slug, date, condition, condition_label,
  air_temperature_max, air_temperature_min (whole-day only),
  relative_humidity, wind_speed (km/h — converted to m/s here)

Nearest-city logic:
  When a farmer's lat/lon is provided, we find the closest CSIS town
  using Haversine distance and return that town's forecast data.
  This gives highland farmers (e.g. Butha-Buthe, Semonkong) accurate
  local data instead of interpolated global model output.

FIX (2026-04-29):
  - load_dotenv() called at module level BEFORE reading LMS_STUB_MODE
    from os.getenv(). Previously LMS_STUB_MODE was always True because
    the module-level os.getenv() ran before main.py called load_dotenv().
  - Retry logic: 2 attempts with 1s wait between on 502/503/504.
    CSIS nginx always takes exactly 60s to return 504 when its backend
    is down, so MAX_ATTEMPTS is kept at 2 (not 5) to avoid 5-minute
    waits before fallback. If CSIS is healthy it responds in < 5s.
    NASA POWER / OWM are used as fallback when both attempts fail.
"""

import asyncio
import logging
import math
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from dotenv import load_dotenv

# IMPORTANT: load_dotenv() MUST be called before os.getenv("LMS_STUB_MODE")
# below. If load_dotenv() is only called in main.py, the module-level
# os.getenv() reads the system environment (where LMS_STUB_MODE is not set)
# and defaults to "true", keeping CSIS permanently disabled.
load_dotenv()

from models.schemas import (
    CurrentWeather,
    DailyForecast,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

CSIS_URL      = os.getenv("LMS_API_URL", "https://share.csis.gov.ls/api/forecasts")
LMS_STUB_MODE = os.getenv("LMS_STUB_MODE", "true").lower() == "true"

# Lesotho is CAT = UTC+2
CAT = timezone(timedelta(hours=2))

# Module-level cache shared across all LMSClient instances within the same process.
# One CSIS fetch covers all 13 towns — no need to fetch again for Butha-Buthe
# if Maseru was already fetched in the same process within the TTL window.
_CSIS_CACHE: dict = {
    "data":       [],
    "fetched_at": 0.0,
    "ttl":        30 * 60,   # 30 minutes
}

# ── All 13 CSIS towns with coordinates ────────────────────────────────────────
CSIS_TOWNS = [
    {"slug": "butha-buthe",   "name": "Butha-Buthe",   "lat": -28.76, "lon": 28.27},
    {"slug": "leribe",        "name": "Leribe",         "lat": -28.88, "lon": 28.07},
    {"slug": "mafeteng",      "name": "Mafeteng",       "lat": -29.83, "lon": 27.24},
    {"slug": "berea",         "name": "Berea",          "lat": -29.16, "lon": 27.74},
    {"slug": "maseru",        "name": "Maseru",         "lat": -29.32, "lon": 27.50},
    {"slug": "mohales-hoek",  "name": "Mohale's Hoek",  "lat": -30.16, "lon": 27.47},
    {"slug": "mokhotlong",    "name": "Mokhotlong",     "lat": -29.31, "lon": 29.06},
    {"slug": "moshoeshoe-i",  "name": "Moshoeshoe I",   "lat": -29.46, "lon": 27.56},
    {"slug": "qachas-nek",    "name": "Qacha's Nek",    "lat": -30.12, "lon": 28.68},
    {"slug": "quthing",       "name": "Quthing",        "lat": -30.40, "lon": 27.70},
    {"slug": "semonkong",     "name": "Semonkong",      "lat": -29.85, "lon": 28.05},
    {"slug": "thaba-tseka",   "name": "Thaba-Tseka",    "lat": -29.52, "lon": 28.61},
    {"slug": "oxbow",         "name": "Oxbow",          "lat": -28.73, "lon": 28.62},
]

# ── Rainfall estimates from condition slug ─────────────────────────────────────
RAIN_MM = {
    "clearsky_day":         0.0,
    "clearsky_night":       0.0,
    "partlycloudy_day":     0.0,
    "partlycloudy_night":   0.0,
    "cloudy":               0.0,
    "fog":                  0.5,
    "lightrain":            3.0,
    "lightsleet":           2.0,
    "rain":                 8.0,
    "heavyrain":            20.0,
    "heavyrainandthunder":  25.0,
    "thunder":              12.0,
    "snow":                 5.0,
    "heavysnow":            10.0,
    "sleet":                4.0,
}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Straight-line distance between two lat/lon points in kilometres."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a     = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nearest_town(latitude: float, longitude: float) -> dict:
    """Return the CSIS town closest to the given coordinates."""
    return min(
        CSIS_TOWNS,
        key=lambda t: _haversine_km(latitude, longitude, t["lat"], t["lon"]),
    )


def _kmh_to_ms(kmh: float) -> float:
    """Convert wind speed from km/h to m/s."""
    return round(kmh / 3.6, 1)


def _rainfall_from_condition(condition: str) -> float:
    """Estimate rainfall_mm from a CSIS condition slug."""
    return RAIN_MM.get(condition.lower(), 0.0)


class LMSClient:
    """
    Client for the CSIS Lesotho Forecast API.

    Provides current conditions and multi-day forecasts for all 13
    towns in Lesotho. No API key required.

    Set LMS_STUB_MODE=false in .env to activate.
    """

    def __init__(self):
        self.stub    = LMS_STUB_MODE
        self.timeout = httpx.Timeout(
            connect=10.0,   # time to establish TCP connection
            read=65.0,      # 65s — CSIS nginx times out its backend at 60s and
                            # returns 504; we need slightly more than 60s to catch it.
                            # If CSIS is healthy it responds in < 5s.
            write=10.0,     # time to send the request body
            pool=5.0,       # time waiting for a connection from the pool
        )

        if self.stub:
            logger.info(
                "LMS/CSIS client in STUB MODE. "
                "Set LMS_STUB_MODE=false in .env to use live CSIS data."
            )
        else:
            logger.info(f"LMS/CSIS client active: {CSIS_URL}")

    def is_live(self) -> bool:
        return not self.stub

    # ── Public interface ───────────────────────────────────────────────────────

    async def get_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
    ) -> Optional[CurrentWeather]:
        """
        Return current conditions for the CSIS town nearest to the given
        coordinates.

        Strategy:
          1. Prefer the midnight snapshot (effective_period_time "00:00:00")
             as the best proxy for current conditions.
          2. If midnight snapshot is absent (CSIS sometimes omits it),
             fall back to any available snapshot for today.
          3. Uses CAT (UTC+2) for date comparison — avoids UTC offset
             causing today's data to appear as tomorrow before 02:00 UTC.

        Returns None if no data found so the aggregator falls back to
        OpenWeatherMap then NASA POWER.
        """
        if self.stub:
            return None

        town = _nearest_town(latitude, longitude)
        logger.info(
            f"CSIS get_current: nearest town to ({latitude:.3f}, {longitude:.3f}) "
            f"is {town['name']}"
        )

        try:
            collections = await self._fetch_all()
        except Exception as e:
            logger.error(f"CSIS fetch failed: {e}")
            return None

        # Use CAT time so we match CSIS date strings correctly
        today = datetime.now(CAT).strftime("%Y-%m-%d")

        # Collect ALL snapshots for our town across all dates
        # CSIS sometimes returns data from days ago — we use the most recent
        # available snapshot rather than requiring today's date specifically.
        all_candidates = []
        for collection in collections:
            for feature in collection.get("features", []):
                props = feature.get("properties", {})
                if props.get("city_slug") != town["slug"]:
                    continue
                # Only include midnight snapshots (current conditions proxy)
                if props.get("effective_period_time") != "00:00:00":
                    continue
                all_candidates.append(props)

        if not all_candidates:
            logger.warning(f"CSIS: no midnight snapshot found for {town['name']}")
            return None

        # Sort by date descending — take the most recent snapshot available
        all_candidates.sort(key=lambda p: p.get("date", ""), reverse=True)
        props = all_candidates[0]
        snap_date = props.get("date", "")[:10]

        if snap_date != today:
            logger.warning(
                f"CSIS: most recent snapshot for {town['name']} is from "
                f"{snap_date} (today is {today}) — CSIS data may be stale"
            )
        else:
            logger.info(
                f"CSIS: using snapshot for {town['name']} on {snap_date}"
            )

        return CurrentWeather(
            latitude           = latitude,
            longitude          = longitude,
            location_name      = location_name or town["name"],
            temperature_c      = float(props.get("air_temperature_max", 20.0)),
            feels_like_c       = None,
            humidity_pct       = float(props.get("relative_humidity", 0.0)),
            wind_speed_ms      = _kmh_to_ms(float(props.get("wind_speed", 0.0))),
            wind_direction_deg = None,
            rainfall_mm        = _rainfall_from_condition(props.get("condition", "")),
            cloud_cover_pct    = None,
            description        = props.get("condition_label", ""),
            source             = WeatherSource.LMS,
        )

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        location_name: Optional[str] = None,
    ) -> Optional[WeatherForecast]:
        """
        Return a multi-day daily forecast for the CSIS town nearest to
        the given coordinates.

        Uses whole-day slots (effective_period_time "00:01:00").
        CSIS provides up to ~16 days. Days parameter is capped at 16.

        Uses CAT (UTC+2) for today's date so past dates are correctly
        excluded regardless of server time zone.

        Returns None in stub mode or if no data found.
        """
        if self.stub:
            return None

        town = _nearest_town(latitude, longitude)
        days = min(days, 16)
        logger.info(
            f"CSIS get_forecast: {days} days for {town['name']} "
            f"(nearest to {latitude:.3f}, {longitude:.3f})"
        )

        try:
            collections = await self._fetch_all()
        except Exception as e:
            logger.error(f"CSIS fetch failed: {e}")
            return None

        # Use CAT time so today's date matches CSIS date strings
        today     = datetime.now(CAT).strftime("%Y-%m-%d")
        # Accept data from up to 3 days ago — CSIS sometimes returns forecasts
        # that were generated a few days back but still cover upcoming days
        min_date  = (datetime.now(CAT) - timedelta(days=3)).strftime("%Y-%m-%d")

        # Collect whole-day entries for our town, sorted by date
        daily: dict[str, DailyForecast] = {}
        for collection in collections:
            for feature in collection.get("features", []):
                props = feature.get("properties", {})

                if props.get("effective_period_time") != "00:01:00":
                    continue
                if props.get("city_slug") != town["slug"]:
                    continue

                date_str = props.get("date", "")[:10]
                if not date_str or date_str in daily:
                    continue
                # Accept dates from min_date onwards (not strictly today)
                if date_str < min_date:
                    continue

                daily[date_str] = DailyForecast(
                    date          = date_str,
                    temp_min_c    = float(props.get("air_temperature_min", 0.0)),
                    temp_max_c    = float(props.get("air_temperature_max", 0.0)),
                    humidity_pct  = float(props.get("relative_humidity", 0.0)),
                    rainfall_mm   = _rainfall_from_condition(props.get("condition", "")),
                    wind_speed_ms = _kmh_to_ms(float(props.get("wind_speed", 0.0))),
                    description   = props.get("condition_label", ""),
                )

        sorted_days = [daily[d] for d in sorted(daily.keys())][:days]

        if not sorted_days:
            logger.warning(
                f"CSIS: no forecast data found for {town['name']} "
                f"(data may be older than 3 days — CSIS may not have updated recently)"
            )
            return None

        # Warn if all data is from the past
        future_days = [d for d in sorted_days if d.date >= today]
        if not future_days:
            logger.warning(
                f"CSIS: all forecast data for {town['name']} is in the past — "
                f"most recent date: {sorted_days[-1].date} (today: {today})"
            )

        logger.info(
            f"CSIS: returning {len(sorted_days)} forecast days for "
            f"{location_name or town['name']}"
        )

        return WeatherForecast(
            latitude      = latitude,
            longitude     = longitude,
            location_name = location_name or town["name"],
            days          = sorted_days,
            source        = WeatherSource.LMS,
        )

    async def health_check(self) -> bool:
        if self.stub:
            return False
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                r = await client.get(CSIS_URL)
                return r.status_code == 200
        except Exception as e:
            logger.warning(f"CSIS health check failed: {e}")
            return False

    # ── Internal ───────────────────────────────────────────────────────────────

    async def _fetch_all(self) -> list:
        """
        Fetch the full CSIS forecast array with exponential backoff retry.

        CSIS returns 504 when its backend is overloaded — this is transient
        and usually resolves on retry. Strategy:
          - Up to 5 attempts
          - Waits 1s, 2s, 4s, 8s between attempts (2^attempt seconds)
          - Only falls through to OWM/NASA POWER if ALL 5 attempts fail

        One CSIS call returns all 13 towns × 16 days. The module-level cache
        means all LMSClient instances within the same process share one copy
        of the data — requests for Maseru, Butha-Buthe and Semonkong all reuse
        the same fetch without hitting CSIS again within the 30-minute TTL.
        """
        age = time.time() - _CSIS_CACHE["fetched_at"]
        if _CSIS_CACHE["data"] and age < _CSIS_CACHE["ttl"]:
            logger.info(
                f"CSIS module cache hit (age {int(age)}s / TTL {int(_CSIS_CACHE['ttl'])}s)"
            )
            return _CSIS_CACHE["data"]

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        MAX_ATTEMPTS = 2   # Each attempt waits 60s for nginx — keep low to fail fast
        last_error   = None

        for attempt in range(MAX_ATTEMPTS):
            try:
                logger.info(
                    f"CSIS fetch attempt {attempt + 1}/{MAX_ATTEMPTS} from {CSIS_URL}"
                )
                async with httpx.AsyncClient(
                    timeout=self.timeout,
                    verify=False,
                    follow_redirects=True,
                    headers=headers,
                ) as client:
                    r = await client.get(CSIS_URL)
                    r.raise_for_status()
                    data = r.json()

                _CSIS_CACHE["data"]       = data
                _CSIS_CACHE["fetched_at"] = time.time()
                logger.info(
                    f"CSIS: fetched {len(data)} FeatureCollections "
                    f"— cached for {int(_CSIS_CACHE['ttl'] // 60)} minutes"
                )
                return data

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code in (502, 503, 504):
                    # Transient overload — retry with exponential backoff
                    wait = 2 ** attempt  # 1, 2, 4, 8, 16 seconds
                    logger.warning(
                        f"CSIS HTTP {e.response.status_code} on attempt "
                        f"{attempt + 1}/{MAX_ATTEMPTS} — retrying in {wait}s..."
                    )
                    if attempt < MAX_ATTEMPTS - 1:
                        await asyncio.sleep(wait)
                        continue
                    logger.error(
                        f"CSIS gave {e.response.status_code} on all "
                        f"{MAX_ATTEMPTS} attempts — handing off to fallback"
                    )
                else:
                    logger.error(
                        f"CSIS HTTP {e.response.status_code}: "
                        f"{e.response.text[:200]}"
                    )
                raise last_error

            except httpx.TimeoutException as e:
                last_error = e
                wait = 2 ** attempt
                logger.warning(
                    f"CSIS timeout on attempt {attempt + 1}/{MAX_ATTEMPTS} "
                    f"— retrying in {wait}s..."
                )
                if attempt < MAX_ATTEMPTS - 1:
                    await asyncio.sleep(wait)
                    continue
                logger.error(
                    f"CSIS timed out on all {MAX_ATTEMPTS} attempts "
                    f"— handing off to fallback"
                )
                raise last_error

            except httpx.ConnectError as e:
                logger.error(f"CSIS connection error (server unreachable): {e}")
                raise

            except Exception as e:
                logger.error(f"CSIS fetch failed ({type(e).__name__}): {e}")
                raise

        raise last_error