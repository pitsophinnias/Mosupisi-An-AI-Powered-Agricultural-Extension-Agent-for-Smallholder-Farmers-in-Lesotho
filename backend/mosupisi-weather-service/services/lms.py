"""
services/lms.py - Lesotho Meteorological Services (LMS) API stub.

This module defines the interface and data mapping for the LMS API.
The LMS API endpoint and authentication details are NOT yet available
to the team. This stub:

  1. Defines the expected interface so the rest of the service can
     call lms_client.get_current(...) / lms_client.get_forecast(...)
     without any code changes once the real API is accessible.

  2. Returns clearly labelled mock/stub data so developers can
     build and test the full pipeline end-to-end now.

  3. Documents what we know about LMS data — replace the TODO
     sections below as information becomes available.

How to activate when the real LMS API is accessible:
  1. Set LMS_API_URL and LMS_API_KEY in your .env file.
  2. Fill in _fetch_current() and _fetch_forecast() with the real
     HTTP calls, mapping LMS field names to our schemas.
  3. Set LMS_STUB_MODE=false in .env.

LMS Contact / Docs:
  - Website : https://www.met.gov.ls
  - TODO    : Obtain API credentials from LMS
  - TODO    : Confirm endpoint URL structure
  - TODO    : Confirm authentication method (API key / OAuth / IP whitelist)
"""

import logging
import os
from datetime import date, timedelta
from typing import Optional

from models.schemas import (
    CurrentWeather,
    DailyForecast,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

LMS_API_URL  = os.getenv("LMS_API_URL",  "")         # e.g. https://api.met.gov.ls/v1
LMS_API_KEY  = os.getenv("LMS_API_KEY",  "")
LMS_STUB_MODE = os.getenv("LMS_STUB_MODE", "true").lower() == "true"


class LMSClient:
    """
    Client for the Lesotho Meteorological Services API.

    Currently operates in stub mode — returns clearly labelled mock data.
    Switch to live mode by providing LMS_API_URL + LMS_API_KEY in .env
    and implementing the TODO methods below.
    """

    def __init__(self):
        self.base_url = LMS_API_URL
        self.api_key  = LMS_API_KEY
        self.stub     = LMS_STUB_MODE or not (self.base_url and self.api_key)

        if self.stub:
            logger.info(
                "LMS client running in STUB MODE. "
                "Set LMS_API_URL + LMS_API_KEY + LMS_STUB_MODE=false to activate."
            )

    def is_live(self) -> bool:
        return not self.stub

    async def get_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str] = None,
    ) -> Optional[CurrentWeather]:
        """
        Fetch current conditions from LMS.
        Returns None in stub mode so the aggregator can fall back gracefully.
        """
        if self.stub:
            return None   # Aggregator will use OWM / NASA POWER instead

        return await self._fetch_current(latitude, longitude, location_name)

    async def get_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int = 7,
        location_name: Optional[str] = None,
    ) -> Optional[WeatherForecast]:
        """
        Fetch daily forecast from LMS.
        Returns None in stub mode.
        """
        if self.stub:
            return None

        return await self._fetch_forecast(latitude, longitude, days, location_name)

    async def health_check(self) -> bool:
        if self.stub:
            return False   # Not available yet
        try:
            # TODO: replace with a lightweight LMS ping endpoint
            return bool(self.base_url and self.api_key)
        except Exception as e:
            logger.warning(f"LMS health check failed: {e}")
            return False

    # ------------------------------------------------------------------
    # TODO: Implement these once LMS API credentials are obtained
    # ------------------------------------------------------------------

    async def _fetch_current(
        self,
        latitude: float,
        longitude: float,
        location_name: Optional[str],
    ) -> CurrentWeather:
        """
        TODO: Call the LMS current conditions endpoint.

        Expected mapping (update field names once LMS docs are available):
            lms_response["temperature"]  → temperature_c
            lms_response["humidity"]     → humidity_pct
            lms_response["wind_speed"]   → wind_speed_ms
            lms_response["rainfall_1h"]  → rainfall_mm
            lms_response["description"]  → description
        """
        raise NotImplementedError(
            "LMS _fetch_current not yet implemented. "
            "Obtain API docs from https://www.met.gov.ls and implement here."
        )

    async def _fetch_forecast(
        self,
        latitude: float,
        longitude: float,
        days: int,
        location_name: Optional[str],
    ) -> WeatherForecast:
        """
        TODO: Call the LMS forecast endpoint.

        LMS may provide district-level forecasts rather than lat/lon — 
        you may need a district lookup step:
            district = await self._coords_to_district(latitude, longitude)
            forecast = await self._fetch_district_forecast(district)
        """
        raise NotImplementedError(
            "LMS _fetch_forecast not yet implemented. "
            "Obtain API docs from https://www.met.gov.ls and implement here."
        )

    async def _coords_to_district(self, latitude: float, longitude: float) -> str:
        """
        TODO: Map coordinates to a Lesotho district name for LMS queries.
        Lesotho districts: Maseru, Berea, Leribe, Butha-Buthe, Mokhotlong,
        Thaba-Tseka, Qacha's Nek, Quthing, Mohale's Hoek, Mafeteng.
        """
        # Rough bounding-box lookup — replace with proper GIS lookup
        # or use the LMS district endpoint directly
        raise NotImplementedError("District lookup not yet implemented")
