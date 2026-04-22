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
"""

import logging
import math
import os
from datetime import datetime
from typing import Optional

import httpx

from models.schemas import (
    CurrentWeather,
    DailyForecast,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

CSIS_URL     = os.getenv("LMS_API_URL", "https://share.csis.gov.ls/api/forecasts")
LMS_STUB_MODE = os.getenv("LMS_STUB_MODE", "true").lower() == "true"

# ── All 13 CSIS towns with coordinates ────────────────────────────────────────
# Used for nearest-city lookup when farmer lat/lon is provided.
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
# CSIS does not provide rainfall_mm — we derive a reasonable estimate
# from the condition slug so alert thresholds and RAG context still work.
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
        self.timeout = httpx.Timeout(90.0)   # CSIS response is ~1.3MB and can be slow

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
        coordinates. Uses the midnight snapshot (effective_period_time 00:00:00)
        of today's forecast as the best available proxy for current conditions.
        Returns None in stub mode so the aggregator falls back to OWM.
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

        # Find today's midnight snapshot for our town
        today = datetime.utcnow().strftime("%Y-%m-%d")
        for collection in collections:
            coll_date = collection.get("date", "")[:10]
            if coll_date != today:
                continue
            for feature in collection.get("features", []):
                props = feature.get("properties", {})
                if props.get("effective_period_time") != "00:00:00":
                    continue
                if props.get("city_slug") != town["slug"]:
                    continue

                return CurrentWeather(
                    latitude          = latitude,
                    longitude         = longitude,
                    location_name     = location_name or town["name"],
                    temperature_c     = float(props.get("air_temperature_max", 20.0)),
                    feels_like_c      = None,
                    humidity_pct      = float(props.get("relative_humidity", 0.0)),
                    wind_speed_ms     = _kmh_to_ms(float(props.get("wind_speed", 0.0))),
                    wind_direction_deg = None,
                    rainfall_mm       = _rainfall_from_condition(props.get("condition", "")),
                    cloud_cover_pct   = None,
                    description       = props.get("condition_label", ""),
                    source            = WeatherSource.LMS,
                )

        logger.warning(f"CSIS: no midnight snapshot found for {town['name']} on {today}")
        return None

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        location_name: Optional[str] = None,
    ) -> Optional[WeatherForecast]:
        """
        Return a multi-day daily forecast for the CSIS town nearest to
        the given coordinates. Uses whole-day slots (effective_period_time 00:01:00).
        CSIS provides up to ~16 days. Days parameter is capped at 16.
        Returns None in stub mode.
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

        # Collect whole-day entries for our town, sorted by date, today onwards only
        today = datetime.utcnow().strftime("%Y-%m-%d")
        daily: dict[str, DailyForecast] = {}
        for collection in collections:
            for feature in collection.get("features", []):
                props = feature.get("properties", {})

                if props.get("effective_period_time") != "00:01:00":
                    continue
                if props.get("city_slug") != town["slug"]:
                    continue

                date_str = props.get("date", "")[:10]   # "2026-04-10"
                if not date_str or date_str in daily:
                    continue
                if date_str < today:                     # skip past dates
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
            logger.warning(f"CSIS: no whole-day forecast found for {town['name']}")
            return None

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
        Fetch the full CSIS forecast array.

        The CSIS server performs double SSL renegotiation which stalls
        httpx's default SSL handling. We work around this by:
          1. Using a permissive SSL context that tolerates renegotiation
          2. Setting a User-Agent matching a browser (server may block Python agents)
          3. Retrying once on timeout
        """
        import ssl

        # Build a permissive SSL context that handles server-side renegotiation
        ssl_ctx = ssl.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE
        ssl_ctx.options |= ssl.OP_LEGACY_SERVER_CONNECT  # allow renegotiation

        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }

        for attempt in range(2):
            try:
                logger.info(f"CSIS fetch attempt {attempt + 1}/2 from {CSIS_URL}")
                async with httpx.AsyncClient(
                    timeout=self.timeout,
                    verify=False,          # skip cert verification (handles renegotiation)
                    follow_redirects=True,
                    headers=headers,
                ) as client:
                    r = await client.get(CSIS_URL)
                    r.raise_for_status()
                    data = r.json()
                logger.info(f"CSIS: fetched {len(data)} FeatureCollections")
                return data
            except httpx.TimeoutException as e:
                logger.warning(f"CSIS timeout on attempt {attempt + 1}/2: {e}")
                if attempt == 1:
                    raise
            except httpx.ConnectError as e:
                logger.error(f"CSIS connection error: {e}")
                raise
            except httpx.HTTPStatusError as e:
                logger.error(f"CSIS HTTP {e.response.status_code}: {e.response.text[:200]}")
                raise
            except Exception as e:
                logger.error(f"CSIS fetch failed ({type(e).__name__}): {e}")
                raise