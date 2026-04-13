"""
routes/alerts.py - Weather alert endpoints.

Endpoints:
  POST /api/alerts/evaluate/current   - Evaluate current conditions for alerts
  POST /api/alerts/evaluate/forecast  - Evaluate forecast for upcoming alerts
  GET  /api/alerts/history            - Retrieve stored alerts from SQLite
"""

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from db.database import get_db
from models.schemas import (
    AlertThresholds,
    CurrentWeather,
    WeatherAlert,
    WeatherForecast,
)
from services.aggregator import WeatherAggregator
from services.alert_engine import AlertEngine

logger = logging.getLogger(__name__)
router = APIRouter()


def _aggregator(db=Depends(get_db)) -> WeatherAggregator:
    return WeatherAggregator(db)


@router.post("/evaluate/current", response_model=list[WeatherAlert])
async def evaluate_current_alerts(
    current: CurrentWeather,
    farmer_id: Optional[str] = Query(None),
):
    """
    Evaluate a CurrentWeather payload against default thresholds and
    return any triggered alerts.

    The caller (API Gateway / Query Controller) passes in current conditions;
    this endpoint returns zero or more WeatherAlert objects that can be
    displayed in-app or forwarded to the SMS gateway.
    """
    engine = AlertEngine()
    alerts = engine.evaluate_current(current, farmer_id=farmer_id)
    logger.info(f"evaluate_current produced {len(alerts)} alerts for farmer={farmer_id}")
    return alerts


@router.post("/evaluate/forecast", response_model=list[WeatherAlert])
async def evaluate_forecast_alerts(
    forecast: WeatherForecast,
    farmer_id: Optional[str] = Query(None),
    thresholds: Optional[AlertThresholds] = None,
):
    """
    Evaluate a WeatherForecast payload for upcoming weather risks.
    Optionally accept custom thresholds (e.g. per-farmer crop settings).
    """
    engine = AlertEngine(thresholds=thresholds)
    alerts = engine.evaluate_forecast(forecast, farmer_id=farmer_id)
    logger.info(f"evaluate_forecast produced {len(alerts)} alerts for farmer={farmer_id}")
    return alerts


@router.get("/history", response_model=list[WeatherAlert])
async def get_alert_history(
    farmer_id: Optional[str] = Query(None, description="Filter by farmer ID"),
    limit: int = Query(50, ge=1, le=200),
    db=Depends(get_db),
):
    """
    Return stored weather alerts from SQLite.
    Optionally filtered by farmer_id.
    """
    if farmer_id:
        async with db.execute(
            "SELECT * FROM weather_alerts WHERE farmer_id = ? ORDER BY triggered_at DESC LIMIT ?",
            (farmer_id, limit),
        ) as cursor:
            rows = await cursor.fetchall()
    else:
        async with db.execute(
            "SELECT * FROM weather_alerts ORDER BY triggered_at DESC LIMIT ?",
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()

    return [_row_to_alert(row) for row in rows]


async def persist_alerts(alerts: list[WeatherAlert], db) -> None:
    """
    Helper used by other parts of the service to persist generated alerts.
    Not a route — imported and called internally.
    """
    for alert in alerts:
        await db.execute(
            """
            INSERT INTO weather_alerts
                (farmer_id, latitude, longitude, severity, title, message,
                 source, triggered_at, status, sms_sent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert.farmer_id,
                alert.latitude,
                alert.longitude,
                alert.severity.value,
                alert.title,
                alert.message,
                alert.source.value,
                alert.triggered_at.isoformat(),
                alert.status.value,
                int(alert.sms_sent),
            ),
        )
    await db.commit()


def _row_to_alert(row) -> WeatherAlert:
    from models.schemas import AlertSeverity, AlertStatus, WeatherSource
    return WeatherAlert(
        id=row["id"],
        farmer_id=row["farmer_id"],
        latitude=row["latitude"],
        longitude=row["longitude"],
        severity=AlertSeverity(row["severity"]),
        title=row["title"],
        message=row["message"],
        source=WeatherSource(row["source"]),
        triggered_at=datetime.fromisoformat(row["triggered_at"]),
        status=AlertStatus(row["status"]),
        sms_sent=bool(row["sms_sent"]),
    )
