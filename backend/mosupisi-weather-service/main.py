"""
main.py - Mosupisi Weather Service

Provides weather forecasts, current conditions, and agricultural climate
context for smallholder farmers in Lesotho. Aggregates data from:
  - NASA POWER API     (agrometeorological / historical)
  - OpenWeatherMap     (real-time + short-term forecast)
  - LMS (stub)         (Lesotho Meteorological Services - plug in when available)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db.database import init_db
from routes import weather, alerts, sources

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise SQLite tables. Shutdown: nothing to tear down yet."""
    logger.info("Initialising Weather Service database...")
    try:
        await init_db()
        logger.info("Database ready")
    except Exception as e:
        logger.error(f"Database init failed: {e}")
    yield
    logger.info("Weather Service shutting down")


app = FastAPI(
    title="Mosupisi Weather Service",
    description=(
        "Aggregated weather and agrometeorological data for Lesotho farmers. "
        "Sources: NASA POWER, OpenWeatherMap, Lesotho Meteorological Services (LMS)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(weather.router, prefix="/api/weather", tags=["weather"])
app.include_router(alerts.router,  prefix="/api/alerts",  tags=["alerts"])
app.include_router(sources.router, prefix="/api/sources", tags=["sources"])


@app.get("/")
async def root():
    return {
        "service": "mosupisi-weather-service",
        "version": "1.0.0",
        "sources": ["nasa_power", "openweathermap", "lms (stub)"],
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "mosupisi-weather-service",
    }
