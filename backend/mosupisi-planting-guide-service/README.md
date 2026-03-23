# Mosupisi – PlantingGuide Microservice

> Part of **Mosupisi** – the AI-Powered Agricultural Extension Agent for smallholder farmers in Lesotho.  
> Bilingual (English + Sesotho) | Crops: maize, sorghum, legumes | Offline-first PWA

---

## Overview

This microservice backs the `PlantingGuide` React component. It replaces all mock data with a real SQLite database and provides AI-powered bilingual advice using the **Lesotho Agromet Bulletin** as its knowledge base (via Groq `llama-3-8b-8192`).

**Port:** `3001`  
**Database:** `planting.db` (SQLite, auto-created on first run)

---

## Quick Start

### 1. Prerequisites

- Python 3.11+
- A free [Groq API key](https://console.groq.com/) (recommended) or OpenAI API key

### 2. Install dependencies

```bash
cd backend/planting-guide-service
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 4. Run the service

```bash
uvicorn main:app --port 3001 --reload
```

The service starts at **http://localhost:3001**  
Interactive API docs: **http://localhost:3001/docs**

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/plantings` | All plantings with computed progress % and stage |
| `POST` | `/api/plantings` | Create a new planting |
| `POST` | `/api/plantings/{id}/action` | Log a farm activity |
| `POST` | `/api/plantings/{id}/advice` | AI bilingual advice (RAG + Agromet) |
| `GET`  | `/api/crop-rotation` | Crop rotation recommendations table |
| `GET`  | `/api/weather-context` | Agromet Bulletin weather context |
| `POST` | `/api/sync` | Upload offline queue, receive delta |
| `GET`  | `/api/sync/delta?since=ISO_DATE` | Records changed since timestamp |
| `GET`  | `/health` | Health check |

---

## Connecting the React Frontend

### Option A – axios baseURL in your API service file

In `src/services/api.js` (or wherever you configure axios):

```js
import axios from 'axios';

export const plantingApi = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});
```

### Option B – per-call URL

```js
const response = await axios.get('http://localhost:3001/api/plantings');
```

### How PlantingGuide.js calls the API

The updated `PlantingGuide.js` (see `frontend/src/components/PlantingGuide/PlantingGuide.js`) replaces the `mockPlantings` array with:

```js
useEffect(() => {
  axios.get('http://localhost:3001/api/plantings')
    .then(res => setPlantings(res.data))
    .catch(err => console.error('PlantingGuide API error:', err));
}, []);
```

### Offline Sync (Dexie → FastAPI)

The frontend uses `db.syncQueue` (Dexie) to queue changes made offline. When back online, call:

```js
const pending = await db.syncQueue.toArray();
await axios.post('http://localhost:3001/api/sync', {
  plantings: pending.map(item => item.data),
  lastSyncTimestamp: lastSync,
});
await db.syncQueue.clear();
```

---

## File Structure

```
backend/planting-guide-service/
├── main.py           ← FastAPI app, CORS, lifespan
├── models.py         ← SQLAlchemy ORM (Planting table)
├── schemas.py        ← Pydantic v2 request/response models
├── database.py       ← SQLite engine, session factory, init_db()
├── crud.py           ← DB operations (CRUD + sync upsert)
├── growth.py         ← Growth stage logic (mirrors PlantingGuide.js)
├── rag.py            ← LLM advice engine + Agromet Bulletin context
├── routes/
│   └── plantings.py  ← All 8 API route handlers
├── .env.example
├── requirements.txt
└── README.md
```

---

## LLM / RAG Architecture

```
POST /api/plantings/{id}/advice
        │
        ▼
  crud.get_planting()       ← fetch crop, stage, location from SQLite
        │
        ▼
  rag.get_advice()
        │
        ├─ System prompt: FULL Agromet Bulletin text (embedded)
        ├─ User prompt:   crop + stage + location + language
        │
        ▼
  Groq llama-3-8b-8192  (fallback: OpenAI gpt-3.5-turbo)
        │
        ▼
  JSON response: advice_en, advice_st, weather_outlook_en/st,
                 rotation_recommendation, sources
```

The Agromet Bulletin (3rd Dekad October 2025 / Nov 1–10 2025) is embedded as a string constant in `rag.py`. To update it for a new bulletin, replace the `AGROMET_BULLETIN_TEXT` constant.

---

## Development Notes

- **Pydantic v2** – all models use `model_config = ConfigDict(...)` syntax
- **SQLAlchemy 2.0** – uses `DeclarativeBase`; no Alembic migrations needed for demo
- **Growth calculations** in `growth.py` mirror the JavaScript in `PlantingGuide.js` exactly
- **Bilingual** – every advice response always contains both `_en` and `_st` fields
- **No Docker** – designed to run directly with `uvicorn`

---

## Updating for Production

1. Set `DATABASE_URL` to a proper PostgreSQL URL in `.env`
2. Move Agromet Bulletin text to a vector store (e.g., ChromaDB) for larger documents
3. Add JWT authentication middleware to protect `/api/plantings`
4. Set `FRONTEND_ORIGIN` to your production domain

---

*Mosupisi – Re sebelisanang le Maemo a Leholimo / Working with the Weather*