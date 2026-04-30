"""
services/nasa_power.py - NASA POWER API client.

NASA POWER (Prediction Of Worldwide Energy Resources) provides free
agrometeorological data going back to 1981. Ideal for:
  - Historical rainfall / temperature baselines
  - Solar radiation (important for crop growth models)
  - Evapotranspiration estimates

Docs: https://power.larc.nasa.gov/docs/services/api/
No API key required — NASA POWER is publicly accessible.

Key parameters used for Lesotho farming context:
  T2M         - Temperature at 2m (°C)
  T2M_MIN     - Min daily temp (°C)
  T2M_MAX     - Max daily temp (°C)
  PRECTOTCORR - Precipitation corrected (mm/day)
  RH2M        - Relative humidity at 2m (%)
  WS2M        - Wind speed at 2m (m/s)
  ALLSKY_SFC_SW_DWN - Solar radiation (MJ/m²/day)

NOTE ON DATA LAG:
  NASA POWER is reanalysis data — it typically lags 5-7 days behind
  the current date. Requesting "today" will return the fill value
  (-999) because that record has not been published yet.

  For get_current() we therefore fetch the most recent reliably
  available day, defined as (today - DATA_LAG_DAYS). The UI labels
  the data source as "NASA POWER" so the farmer knows it is recent
  historical data, not a live reading.
"""

import logging
import os
from datetime import date, timedelta
from typing import Optional

import httpx

from models.schemas import AgroClimateData, CurrentWeather, DailyForecast, WeatherForecast, WeatherSource

logger = logging.getLogger(__name__)

NASA_POWER_BASE = os.getenv(
    "NASA_POWER_API_URL",
    "https://power.larc.nasa.gov/api/temporal/daily/point",
)

# Parameters we request from NASA POWER
AGRO_PARAMS = ",".join([
    "T2M",
    "T2M_MIN",
    "T2M_MAX",
    "PRECTOTCORR",
    "RH2M",
    "WS2M",
    "ALLSKY_SFC_SW_DWN",
])

# NASA POWER uses this fill value for missing / not-yet-published data
FILL_VALUE = -999.0

# How many days behind today NASA POWER data is reliably available.
# Requesting dates more recent than (today - DATA_LAG_DAYS) returns
# fill values (-999) because the record has not been published yet.
DATA_LAG_DAYS = 2


def _clean(value: float) -> Optional[float]:
    """Replace NASA POWER fill values with None."""
    if value is None or value <= FILL_VALUE:
        return None
    return round(value, 2)


def _farming_note(day: dict) -> Optional[str]:
    """
    Generate a short farming-relevant note from daily parameters.
    Tuned for Lesotho highland / lowland conditions.
    """
    notes = []
    t_min = _clean(day.get("T2M_MIN"))
    t_max = _clean(day.get("T2M_MAX"))
    rain  = _clean(day.get("PRECTOTCORR"))
    solar = _clean(day.get("ALLSKY_SFC_SW_DWN"))

    if t_min is not None and t_min <= 2.0:
        notes.append("⚠️ Frost risk — protect seedlings overnight.")
    if t_max is not None and t_max >= 35.0:
        notes.append("🌡️ Heat stress risk — irrigate if possible.")
    if rain is not None and rain >= 20.0:
        notes.append("🌧️ Heavy rain expected — delay spraying operations.")
    if rain is not None and rain == 0.0:
        notes.append("☀️ No rain — monitor soil moisture.")
    if solar is not None and solar >= 20.0:
        notes.append("☀️ High solar radiation — good conditions for solar drying.")

    return " ".join(notes) if notes else None


class NASAPowerClient:
    """Async client for the NASA POWER Daily Point API."""

    def __init__(self):
        self.timeout = httpx.Timeout(30.0)

    async def get_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
    ) -> CurrentWeather:
        """
        Return the most recent available conditions from NASA POWER as a
        proxy for current weather when CSIS is unavailable.

        NASA POWER is reanalysis data with a ~2-day publication lag.
        Fetching 'today' returns fill values (-999) because that record
        has not yet been published. We therefore request the date at
        (today - DATA_LAG_DAYS), which is the most recent day guaranteed
        to have real data.

        T2M (mean 2m temperature) is used for temperature_c.
        T2M_MAX is used as a secondary fallback if T2M is unavailable.
        """
        # Most recent day NASA POWER reliably has data for
        target_dt = date.today() - timedelta(days=DATA_LAG_DAYS)
        target_str = target_dt.strftime("%Y%m%d")

        logger.info(
            f"NASA POWER get_current: fetching {target_dt} "
            f"(today - {DATA_LAG_DAYS} days) for ({latitude}, {longitude})"
        )

        params = await self._fetch(
            latitude=latitude,
            longitude=longitude,
            start=target_str,
            end=target_str,
        )

        if not params:
            logger.warning("NASA POWER get_current: no data returned — returning 0-value fallback")
            return self._zero_current(latitude, longitude, location_name)

        day_data = next(iter(params.values()))

        temperature_c = _clean(day_data.get("T2M"))
        if temperature_c is None:
            # T2M occasionally missing; try T2M_MAX as fallback
            temperature_c = _clean(day_data.get("T2M_MAX"))
        if temperature_c is None:
            logger.warning(
                f"NASA POWER: T2M and T2M_MAX both fill values for {target_dt} — "
                "data may not yet be published for this date, try increasing DATA_LAG_DAYS"
            )
            temperature_c = 0.0

        humidity_pct  = _clean(day_data.get("RH2M"))
        wind_speed_ms = _clean(day_data.get("WS2M"))
        rainfall_mm   = _clean(day_data.get("PRECTOTCORR"))

        logger.info(
            f"NASA POWER get_current: temp={temperature_c}°C  "
            f"humidity={humidity_pct}%  wind={wind_speed_ms}m/s  rain={rainfall_mm}mm"
        )

        return CurrentWeather(
            latitude      = latitude,
            longitude     = longitude,
            location_name = location_name,
            temperature_c = temperature_c,
            feels_like_c  = None,
            humidity_pct  = humidity_pct,
            wind_speed_ms = wind_speed_ms,
            wind_direction_deg = None,
            rainfall_mm   = rainfall_mm,
            cloud_cover_pct = None,
            description   = f"Data from {target_dt.strftime('%d %b')} (NASA POWER)",
            source        = WeatherSource.NASA_POWER,
        )

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        location_name: Optional[str] = None,
    ) -> WeatherForecast:
        """
        Build a near-term forecast from NASA POWER.

        NOTE: NASA POWER has a ~2-day data lag (it is reanalysis data,
        not a true NWP forecast). We fetch the most recent available days
        as a proxy for near-term conditions. For true forecasts, pair with
        OpenWeatherMap.
        """
        end_dt   = date.today() - timedelta(days=DATA_LAG_DAYS)
        start_dt = end_dt - timedelta(days=days - 1)

        params = await self._fetch(
            latitude=latitude,
            longitude=longitude,
            start=start_dt.strftime("%Y%m%d"),
            end=end_dt.strftime("%Y%m%d"),
        )

        daily_forecasts = []
        for date_str, day_data in params.items():
            daily_forecasts.append(DailyForecast(
                date=f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}",
                temp_min_c=_clean(day_data.get("T2M_MIN")) or 0.0,
                temp_max_c=_clean(day_data.get("T2M_MAX")) or 0.0,
                humidity_pct=_clean(day_data.get("RH2M")),
                rainfall_mm=_clean(day_data.get("PRECTOTCORR")),
                wind_speed_ms=_clean(day_data.get("WS2M")),
                solar_radiation_mj=_clean(day_data.get("ALLSKY_SFC_SW_DWN")),
                farming_note=_farming_note(day_data),
            ))

        daily_forecasts.sort(key=lambda d: d.date)

        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
            days=daily_forecasts,
            source=WeatherSource.NASA_POWER,
        )

    async def get_agro_climate(
        self,
        latitude: float,
        longitude: float,
        start_date: str,
        end_date: str,
    ) -> AgroClimateData:
        """
        Fetch aggregated agrometeorological summary for a date range.
        Useful for crop planning, season analysis, and RAG context building.
        """
        start = start_date.replace("-", "")
        end   = end_date.replace("-", "")

        params = await self._fetch(
            latitude=latitude,
            longitude=longitude,
            start=start,
            end=end,
        )

        t_vals    = [_clean(v.get("T2M"))              for v in params.values() if _clean(v.get("T2M"))              is not None]
        rain_vals = [_clean(v.get("PRECTOTCORR"))      for v in params.values() if _clean(v.get("PRECTOTCORR"))      is not None]
        rh_vals   = [_clean(v.get("RH2M"))             for v in params.values() if _clean(v.get("RH2M"))             is not None]
        ws_vals   = [_clean(v.get("WS2M"))             for v in params.values() if _clean(v.get("WS2M"))             is not None]
        sr_vals   = [_clean(v.get("ALLSKY_SFC_SW_DWN")) for v in params.values() if _clean(v.get("ALLSKY_SFC_SW_DWN")) is not None]

        return AgroClimateData(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
            temperature_avg_c=round(sum(t_vals) / len(t_vals), 2)    if t_vals    else None,
            precipitation_mm=round(sum(rain_vals), 2)                 if rain_vals else None,
            solar_radiation_mj=round(sum(sr_vals) / len(sr_vals), 2) if sr_vals   else None,
            relative_humidity_pct=round(sum(rh_vals) / len(rh_vals), 2) if rh_vals else None,
            wind_speed_ms=round(sum(ws_vals) / len(ws_vals), 2)       if ws_vals   else None,
        )

    async def _fetch(
        self,
        latitude: float,
        longitude: float,
        start: str,
        end: str,
    ) -> dict:
        """
        Raw fetch from the NASA POWER Daily Point endpoint.
        Returns a dict keyed by YYYYMMDD date strings.
        """
        query_params = {
            "parameters": AGRO_PARAMS,
            "community":  "AG",
            "longitude":  longitude,
            "latitude":   latitude,
            "start":      start,
            "end":        end,
            "format":     "JSON",
        }

        logger.info(f"NASA POWER fetch: lat={latitude}, lon={longitude}, {start}→{end}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(NASA_POWER_BASE, params=query_params)
            response.raise_for_status()
            data = response.json()

        # Navigate the nested NASA POWER JSON structure:
        # data["properties"]["parameter"]["T2M"]["20250101"] = value
        parameters = data.get("properties", {}).get("parameter", {})

        # Transpose: {param: {date: val}} → {date: {param: val}}
        dates: dict[str, dict] = {}
        for param_name, date_values in parameters.items():
            for date_str, value in date_values.items():
                if date_str not in dates:
                    dates[date_str] = {}
                dates[date_str][param_name] = value

        logger.info(f"NASA POWER returned {len(dates)} daily records")
        return dates

    async def health_check(self) -> bool:
        """Ping NASA POWER with a minimal request to verify connectivity."""
        try:
            target = (date.today() - timedelta(days=DATA_LAG_DAYS)).strftime("%Y%m%d")
            await self._fetch(
                latitude=-29.3167,
                longitude=27.4833,
                start=target,
                end=target,
            )
            return True
        except Exception as e:
            logger.warning(f"NASA POWER health check failed: {e}")
            return False

    def _zero_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str],
    ) -> CurrentWeather:
        """Last-resort fallback when NASA POWER returns no records at all."""
        return CurrentWeather(
            latitude      = latitude,
            longitude     = longitude,
            location_name = location_name,
            temperature_c = 0.0,
            feels_like_c  = None,
            humidity_pct  = None,
            wind_speed_ms = None,
            wind_direction_deg = None,
            rainfall_mm   = None,
            cloud_cover_pct = None,
            description   = "Weather data temporarily unavailable",
            source        = WeatherSource.NASA_POWER,
        )