# mosupisi-weather-service

Aggregated weather and agrometeorological data service for the Mosupisi
agricultural extension platform. Serves Lesotho smallholder farmers.

## Weather Sources

| Source | Type | API Key | Status |
|---|---|---|---|
| NASA POWER | Agrometeorological / historical | None required | ✅ Live |
| OpenWeatherMap | Real-time + 7-day forecast | Required | ✅ Live (mock if no key) |
| LMS (Lesotho Met) | Local official forecasts | Required | 🔧 Stub — activate when key obtained |

## Quick Start

```bash
# 1. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env — add OPENWEATHERMAP_API_KEY if you have one

# 4. Run the service
uvicorn main:app --reload --port 8002
```

Visit http://localhost:8002/docs for the interactive API docs.

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service health check |
| POST | `/api/weather/current` | Current conditions (OWM → LMS fallback) |
| POST | `/api/weather/forecast` | Multi-day forecast (OWM + NASA enriched) |
| POST | `/api/weather/agro-climate` | NASA POWER agro summary for date range |
| GET | `/api/weather/forecast/maseru` | Quick Maseru forecast (dev helper) |
| POST | `/api/alerts/evaluate/current` | Evaluate current conditions for alerts |
| POST | `/api/alerts/evaluate/forecast` | Evaluate forecast for upcoming risks |
| GET | `/api/alerts/history` | Stored alert history from SQLite |
| GET | `/api/sources/status` | Health check all three weather sources |

## Adding the LMS API

When you obtain credentials from the Lesotho Meteorological Services (https://www.met.gov.ls):

1. Set in `.env`:
   ```
   LMS_API_URL=https://api.met.gov.ls/v1   # confirm actual URL
   LMS_API_KEY=your_key_here
   LMS_STUB_MODE=false
   ```
2. Implement `_fetch_current()` and `_fetch_forecast()` in `services/lms.py`.
   The methods have `TODO` comments with the expected field mappings.

## Migrating to PostgreSQL

1. Install `asyncpg`: `pip install asyncpg`
2. Update `DATABASE_PATH` in `.env` to a PostgreSQL URL:
   ```
   DATABASE_URL=postgresql+asyncpg://user:password@host/mosupisi_weather
   ```
3. Update `db/database.py` to use SQLAlchemy async engine with that URL.
   All table schemas are standard SQL — no changes needed.

## Architecture Position

```
Frontend (PWA)
    ↓ REST
API Gateway
    ↓
Weather Service  ←→  NASA POWER API
(this service)   ←→  OpenWeatherMap API
                 ←→  LMS API (stub)
    ↓
SQLite (cache + alert log)
```
