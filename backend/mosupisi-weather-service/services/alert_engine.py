"""
services/alert_engine.py - Weather alert evaluation engine.

Evaluates current conditions and forecasts against configurable thresholds
and produces WeatherAlert objects.

Twilio SMS dispatch is STUBBED — the interface is fully defined so you can
activate it later by:
  1. pip install twilio
  2. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in .env
  3. Set TWILIO_ENABLED=true in .env
  4. Uncomment the send_sms() implementation below.
"""

import logging
import os
from datetime import datetime
from typing import Optional

from models.schemas import (
    AlertSeverity,
    AlertStatus,
    AlertThresholds,
    CurrentWeather,
    DailyForecast,
    WeatherAlert,
    WeatherForecast,
    WeatherSource,
)

logger = logging.getLogger(__name__)

TWILIO_ENABLED = os.getenv("TWILIO_ENABLED", "false").lower() == "true"


class AlertEngine:
    """
    Evaluates weather data against thresholds and generates alerts.
    Twilio SMS dispatch is stubbed pending activation.
    """

    def __init__(self, thresholds: Optional[AlertThresholds] = None):
        self.thresholds = thresholds or AlertThresholds()

    def evaluate_current(
        self,
        current: CurrentWeather,
        farmer_id: Optional[str] = None,
    ) -> list[WeatherAlert]:
        """Check current conditions against thresholds and return any alerts."""
        alerts = []
        t = self.thresholds

        if current.temperature_c <= t.temp_frost_c:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=current.latitude,
                longitude=current.longitude,
                severity=AlertSeverity.WARNING,
                title="Frost Risk",
                message=(
                    f"Temperature has dropped to {current.temperature_c}°C. "
                    "Protect young crops and seedlings from frost damage tonight."
                ),
                source=current.source,
            ))

        if current.temperature_c >= t.temp_heat_c:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=current.latitude,
                longitude=current.longitude,
                severity=AlertSeverity.WARNING,
                title="Heat Stress Alert",
                message=(
                    f"Temperature is {current.temperature_c}°C. "
                    "Irrigate crops early morning or evening to reduce heat stress."
                ),
                source=current.source,
            ))

        if current.rainfall_mm is not None and current.rainfall_mm >= t.rain_heavy_mm:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=current.latitude,
                longitude=current.longitude,
                severity=AlertSeverity.SEVERE,
                title="Heavy Rainfall",
                message=(
                    f"Heavy rainfall of {current.rainfall_mm}mm in the last hour. "
                    "Risk of waterlogging and soil erosion on slopes. "
                    "Delay fertiliser and pesticide applications."
                ),
                source=current.source,
            ))

        if current.wind_speed_ms >= t.wind_strong_ms:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=current.latitude,
                longitude=current.longitude,
                severity=AlertSeverity.WARNING,
                title="Strong Wind",
                message=(
                    f"Wind speed is {current.wind_speed_ms} m/s. "
                    "Avoid spraying operations. Secure greenhouse covers and irrigation equipment."
                ),
                source=current.source,
            ))

        return alerts

    def evaluate_forecast(
        self,
        forecast: WeatherForecast,
        farmer_id: Optional[str] = None,
    ) -> list[WeatherAlert]:
        """Scan upcoming forecast days and generate forward-looking alerts."""
        alerts = []
        t = self.thresholds
        consecutive_dry = 0

        for day in forecast.days:
            alerts.extend(self._check_day(day, forecast, farmer_id, t))

            # Track consecutive dry days for drought alert
            if day.rainfall_mm is not None and day.rainfall_mm < 1.0:
                consecutive_dry += 1
            else:
                consecutive_dry = 0

            if consecutive_dry >= t.rain_drought_days:
                alerts.append(WeatherAlert(
                    farmer_id=farmer_id,
                    latitude=forecast.latitude,
                    longitude=forecast.longitude,
                    severity=AlertSeverity.SEVERE,
                    title="Drought Risk",
                    message=(
                        f"{consecutive_dry} consecutive days without meaningful rainfall. "
                        "Consider water conservation measures and drought-tolerant practices."
                    ),
                    source=forecast.source,
                ))
                consecutive_dry = 0   # Reset to avoid repeated alerts

        return alerts

    def _check_day(
        self,
        day: DailyForecast,
        forecast: WeatherForecast,
        farmer_id: Optional[str],
        t: AlertThresholds,
    ) -> list[WeatherAlert]:
        alerts = []

        if day.temp_min_c <= t.temp_frost_c:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=forecast.latitude,
                longitude=forecast.longitude,
                severity=AlertSeverity.WARNING,
                title=f"Frost Risk on {day.date}",
                message=(
                    f"Forecast minimum temperature of {day.temp_min_c}°C on {day.date}. "
                    "Protect seedlings and frost-sensitive crops the night before."
                ),
                source=forecast.source,
            ))

        if day.temp_max_c >= t.temp_heat_c:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=forecast.latitude,
                longitude=forecast.longitude,
                severity=AlertSeverity.WARNING,
                title=f"Heat Stress Forecast {day.date}",
                message=(
                    f"Maximum temperature of {day.temp_max_c}°C forecast for {day.date}. "
                    "Schedule irrigation for early morning."
                ),
                source=forecast.source,
            ))

        if day.rainfall_mm is not None and day.rainfall_mm >= t.rain_heavy_mm:
            alerts.append(WeatherAlert(
                farmer_id=farmer_id,
                latitude=forecast.latitude,
                longitude=forecast.longitude,
                severity=AlertSeverity.SEVERE,
                title=f"Heavy Rain Forecast {day.date}",
                message=(
                    f"{day.rainfall_mm}mm of rain forecast for {day.date}. "
                    "Delay planting and chemical applications. Check field drainage."
                ),
                source=forecast.source,
            ))

        return alerts

    # ------------------------------------------------------------------
    # Twilio SMS dispatch (STUBBED — activate via .env)
    # ------------------------------------------------------------------

    async def send_sms(self, alert: WeatherAlert, phone_number: str) -> bool:
        """
        Dispatch an alert via Twilio SMS.

        Currently STUBBED. To activate:
          1. pip install twilio
          2. Set in .env:
               TWILIO_ENABLED=true
               TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
               TWILIO_AUTH_TOKEN=your_auth_token
               TWILIO_FROM_NUMBER=+266XXXXXXXX   (your Twilio number)
          3. Uncomment the implementation block below.
        """
        if not TWILIO_ENABLED:
            logger.info(
                f"[SMS STUB] Would send to {phone_number}: "
                f"[{alert.severity.value.upper()}] {alert.title} — {alert.message[:80]}..."
            )
            return True   # Pretend success in stub mode

        # --- Uncomment when Twilio is activated ---
        # from twilio.rest import Client
        # account_sid = os.getenv("TWILIO_ACCOUNT_SID")
        # auth_token  = os.getenv("TWILIO_AUTH_TOKEN")
        # from_number = os.getenv("TWILIO_FROM_NUMBER")
        #
        # client = Client(account_sid, auth_token)
        # sms_body = (
        #     f"🌤 Mosupisi Alert [{alert.severity.value.upper()}]\n"
        #     f"{alert.title}\n"
        #     f"{alert.message}\n"
        #     f"— Mosupisi Agricultural Assistant"
        # )
        # try:
        #     message = client.messages.create(
        #         body=sms_body,
        #         from_=from_number,
        #         to=phone_number,
        #     )
        #     logger.info(f"SMS sent: SID={message.sid}")
        #     return True
        # except Exception as e:
        #     logger.error(f"Twilio SMS failed: {e}")
        #     return False

        return False
