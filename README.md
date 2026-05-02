# Mosupisi - AI-Powered Agricultural Extension Platform


**Mosupisi** (Sesotho for "guide" or "one who shows the way") is an AI-powered agricultural advisory platform designed specifically for smallholder farmers and extension officers in **Lesotho**. It delivers practical, bilingual (English + Sesotho) guidance on planting, pest control, weather-aware decisions, and general farming queries using a **local quantized LLM** and **Retrieval-Augmented Generation (RAG)**.

- **Offline-first**: works in low-connectivity rural areas with data synchronisation when connectivity is restored.  
- **Locally grounded**: RAG knowledge base built from official Lesotho Meteorological Services (LMS) Agrometeorological Bulletins (2010-2026).  
- **Bilingual**: full English and Sesotho interface with on-the-fly translation of AI advice.  
- **Proactive alerts**: weather hazards, crop milestones, pest risks, and spray windows via SMS and push notifications.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services & Ports](#services--ports)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Environment Variables](#2-environment-variables)
  - [3. Model Placement (Critical)](#3-model-placement-critical)
  - [4. Install Dependencies](#4-install-dependencies)
- [Running Mosupisi](#running-mosupisi)
  - [Option A: Automated Scripts (Recommended)](#option-a-automated-scripts-recommended)
  - [Option B: Manual Start (Order matters)](#option-b-manual-start-order-matters)
- [Health Checks](#health-checks)
- [Using the Platform](#using-the-platform)
- [Troubleshooting](#troubleshooting)
- [Next Steps & Future Work](#next-steps--future-work)


---

## Architecture Overview

Mosupisi follows a **microservices architecture** with independent, loosely coupled services. A central **LLM service** loads the quantised Mistral model (`mosupisi-q4.gguf`) and serves all other modules. RAG retrieval is performed via ChromaDB using sentence-transformer embeddings (`all-MiniLM-L6-v2`).

### How the System Fits Together

At the centre of the platform is the **LLM Service** (port 3004), which loads the quantised Mistral model (`mosupisi-q4.gguf`) and exposes a single `/infer` endpoint. Every other backend service that needs AI-generated text calls this endpoint - none of them load the model themselves. This keeps memory usage centralised and makes it possible to run on modest hardware.

Around the LLM service sit five specialised **domain services**, each with its own SQLite database and its own FastAPI application:

- The **Planting Guide Service** manages crop records and growth stages. When a farmer logs an activity or requests advice, it retrieves relevant passages from the ChromaDB vector store (built from LMS Agrometeorological Bulletins using `all-MiniLM-L6-v2` sentence-transformer embeddings) and sends them together with the query to the LLM service - this is the RAG pipeline.
- The **Pest Control Service** follows the same RAG pattern but focuses on pest identification, risk assessment, and treatment recommendations.
- The **Weather Service** fetches current conditions and forecasts from CSIS, falling back to NASA POWER when the primary source is unavailable. Its data is consumed by the Chat, Notification, and Planting Guide services to ground advice in real conditions.
- The **Profile Service** handles farmer registration, JWT-based authentication, and profile management. All other services trust its issued tokens.
- The **Notification Service** runs a daily scheduler (default 06:00) that pulls weather data and farmer records, then fires SMS alerts via Africa's Talking (or a stub in development) for frost, heat waves, heavy rain, and spray windows.

The **Chat Service** is split into two processes: a lightweight **Node.js/Express gateway** (port 3002) that handles WebSocket connections from the browser, and a **Python FastAPI backend** (port 3003) that injects the current weather context, manages conversation history, and calls the LLM service. This split keeps the real-time connection layer thin and language-agnostic.

The **React PWA frontend** (port 3000) talks directly to each domain service via REST. It uses IndexedDB to cache weather and planting data locally, enabling offline use. When connectivity is restored, planting records are delta-synced back to the server.

Key design decisions:
- **Local inference** - no cloud API dependency → offline capable.
- **SQLite + IndexedDB** - each service has its own database; frontend caches weather and planting data.
- **Delta sync** - planting records sync incrementally after reconnection.
- **SMS fallback** - critical alerts sent via Africa's Talking (sandbox mode by default).

---

## Services & Ports

All backend services reside in the `backend/` directory.

| Service                           | Port                                | Tech stack                                 | Responsibility                                          |
|-----------------------------------|-------------------------------------|--------------------------------------------|---------------------------------------------------------|
| `mosupisi-llm-service`            | 3004                                | Python (FastAPI) + llama-cpp               | Central LLM inference (`/infer` endpoint)              |
| `mosupisi-planting-guide-service` | 3001                                | Python (FastAPI)                           | Planting records, growth stages, stage-based AI advice |
| `mosupisi-pest-control-service`   | 8001                                | Python (FastAPI)                           | Pest library, pest reports, weather-aware pest advice  |
| `mosupisi-chat-service`           | 3002 (Node)<br>3003 (Python)        | Node.js + Express<br>Python (FastAPI)      | Chat gateway (Node) and AI backend (Python)            |
| `mosupisi-profile-service`        | 8003                                | Python (FastAPI) + JWT                     | Farmer registration, authentication, profile management|
| `mosupisi-weather-service`        | 8002                                | Python (FastAPI)                           | Current weather, forecast (CSIS / NASA POWER fallback) |
| `mosupisi-notification-service`   | 8004                                | Python (FastAPI)                           | Daily checks, SMS alerts, push notifications           |
| **Frontend**                      | 3000                                | React + Material UI                        | Progressive Web App (PWA)                              |

All services must be **started in the correct order** (LLM first, then the rest).

---

## Prerequisites

- **Python 3.10 or 3.11** (3.12 also works)
- **Node.js 18+** (for the chat gateway and frontend)
- **Git**
- **8-16 GB RAM** (LLM + embeddings + ChromaDB may use ~6-8 GB)
- **(Optional) GPU** - set `LLAMA_GPU_LAYERS > 0` in the LLM service `.env`

> [!NOTE]
> The first start of the planting guide and chat services will take 20-40 seconds while downloading/loading the sentence-transformer model and building the ChromaDB index.

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/mosupisi.git
cd mosupisi
```

### 2. Environment Variables

`.env` files are **not committed to Git**. Each service folder ships with a `.env.example` listing every required variable. Copy it to `.env` and fill in your own values before starting the service:

```bash
cp .env.example .env
```

#### `backend/mosupisi-llm-service/.env.example`
```ini
LLAMA_N_CTX=
LLAMA_THREADS=
LLAMA_GPU_LAYERS=
ALLOWED_ORIGINS=
# Optional: absolute path to model if not in default locations
LLAMA_MODEL_PATH=
```

#### `backend/mosupisi-planting-guide-service/.env.example`
```ini
LLM_SERVICE_URL=
```

#### `backend/mosupisi-pest-control-service/.env.example`
```ini
LLM_SERVICE_URL=
```

#### `backend/mosupisi-chat-service/.env.example` (Node gateway)
```ini
PORT=
PYTHON_AI_URL=
```

#### `backend/mosupisi-profile-service/.env.example`
```ini
APP_HOST=
APP_PORT=
DEBUG=
DATABASE_URL=
SECRET_KEY=
ALGORITHM=
ACCESS_TOKEN_EXPIRE_MINUTES=
REFRESH_TOKEN_EXPIRE_DAYS=
OTP_EXPIRE_MINUTES=
AT_USERNAME=
AT_API_KEY=
AT_SENDER_ID=
AT_SANDBOX=
SMS_STUB_FALLBACK=
ALLOWED_ORIGINS=
```

#### `backend/mosupisi-notification-service/.env.example`
```ini
APP_HOST=
APP_PORT=
DEBUG=
DATABASE_URL=
PROFILE_SERVICE_URL=
WEATHER_SERVICE_URL=
AT_USERNAME=
AT_API_KEY=
AT_SANDBOX=
SMS_STUB_FALLBACK=
DAILY_CHECK_HOUR=
DAILY_CHECK_MINUTE=
FROST_THRESHOLD_C=
HEAT_THRESHOLD_C=
ALLOWED_ORIGINS=
```

Other services (weather, chat Python) require only `LLM_SERVICE_URL` in their `.env.example`.

### 3. Model Placement (Critical)

The LLM service looks for `mosupisi-q4.gguf` in the following order:

1. `backend/mosupisi-planting-guide-service/models/mosupisi-q4.gguf`
2. `backend/mosupisi-pest-control-service/models/mosupisi-q4.gguf`
3. The path set by `LLAMA_MODEL_PATH` in `.env.example`

> **Place the model file** in the planting guide service `models` folder (preferred).  
> If the file is missing, the LLM service will raise a `FileNotFoundError` with the searched paths.

### 4. Install Dependencies

#### Backend (each Python service)
```bash
cd backend/<service-name>
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate
pip install -r requirements.txt
```

#### Node gateway & frontend
```bash
cd backend/mosupisi-chat-service
npm install

cd ../../mosupisi-frontend
npm install
```

---

## Running Mosupisi

### Option A: Automated Scripts (Recommended)

We provide scripts that open each service in a separate terminal window/tab.

#### Linux / macOS / WSL (`start-all.sh`)

Create `start-all.sh` in the **project root**:

```bash
#!/bin/bash
echo "🚀 Starting Mosupisi Agricultural Platform..."

start_service() {
    local name=$1
    local dir=$2
    local cmd=$3
    echo "Starting $name..."
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal --title="$name" -- bash -c "cd $dir && $cmd; exec bash" &
    elif command -v xterm &> /dev/null; then
        xterm -T "$name" -e "cd $dir && $cmd; exec bash" &
    else
        (cd $dir && $cmd) &
    fi
}

# 1. LLM Service (MUST be first)
start_service "LLM Service" "backend/mosupisi-llm-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 3004 --reload"

# 2. Core services
start_service "Planting Guide" "backend/mosupisi-planting-guide-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 3001 --reload"
start_service "Pest Control" "backend/mosupisi-pest-control-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
start_service "Profile" "backend/mosupisi-profile-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8003 --reload"
start_service "Weather" "backend/mosupisi-weather-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8002 --reload"
start_service "Notification" "backend/mosupisi-notification-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8004 --reload"

# 3. Chat service
start_service "Chat Python AI" "backend/mosupisi-chat-service" \
    ".venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 3003 --reload"
(cd backend/mosupisi-chat-service && npm start) &

# 4. Frontend
(cd mosupisi-frontend && npm start) &

echo "✅ All services launched. Access http://localhost:3000"
```

Make it executable:
```bash
chmod +x start-all.sh
bash start-all.sh
```

#### Windows (`start-all.bat`)

Create `start-all.bat` in the project root:

```batch
@echo off
echo Starting Mosupisi services...

start "LLM Service" cmd /k "cd backend\mosupisi-llm-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 3004 --reload"
timeout /t 3

start "Planting Guide" cmd /k "cd backend\mosupisi-planting-guide-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 3001 --reload"
start "Pest Control" cmd /k "cd backend\mosupisi-pest-control-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"
start "Profile Service" cmd /k "cd backend\mosupisi-profile-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8003 --reload"
start "Weather Service" cmd /k "cd backend\mosupisi-weather-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8002 --reload"
start "Notification Service" cmd /k "cd backend\mosupisi-notification-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8004 --reload"
start "Chat Python AI" cmd /k "cd backend\mosupisi-chat-service && .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 3003 --reload"
start "Chat Node Gateway" cmd /k "cd backend\mosupisi-chat-service && npm start"
start "Frontend" cmd /k "cd mosupisi-frontend && npm start"

echo All services started. Access http://localhost:3000
pause
```

### Option B: Manual Start (Order matters)

Start each service **in a separate terminal** in this order:

1. **LLM Service** (port 3004) - wait for `LLM service ready` message.
2. **Weather Service** (port 8002)
3. **Profile Service** (port 8003)
4. **Notification Service** (port 8004)
5. **Planting Guide Service** (port 3001)
6. **Pest Control Service** (port 8001)
7. **Chat Python AI** (port 3003)
8. **Chat Node Gateway** (port 3002)
9. **Frontend** (port 3000)

For each Python service (example):
```bash
cd backend/mosupisi-llm-service
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 3004 --reload
```

For Node gateway:
```bash
cd backend/mosupisi-chat-service
npm start
```

For frontend:
```bash
cd mosupisi-frontend
npm start
```

---

## Health Checks

After all services are running, verify they are healthy:

| Service        | Health endpoint                    |
|----------------|------------------------------------|
| LLM            | `http://localhost:3004/health`     |
| Planting Guide | `http://localhost:3001/health`     |
| Pest Control   | `http://localhost:8001/health`     |
| Profile        | `http://localhost:8003/health`     |
| Weather        | `http://localhost:8002/health`     |
| Notification   | `http://localhost:8004/health`     |
| Chat (Node)    | `http://localhost:3002/api/health` |

You can use `curl` or open the URLs in a browser. A successful response returns `{"status":"healthy"}` or similar.

---

## Using the Platform

1. Open your browser at **`http://localhost:3000`**
2. **Register** as a farmer or extension officer (phone number, name, district, language).
3. **Log in** with your credentials.
4. **Planting Guide** - add crops (maize, sorghum, legumes), record planting dates, log activities (watering, fertilising, weeding) and receive stage-specific AI advice with weather outlook.
5. **Pest Control** - browse the pest library, report sightings, get treatment advice, and log control actions.
6. **Chat** - ask any farming question in English or Sesotho. Weather context is automatically included.
7. **Weather & Alerts** - view current weather and forecasts for your district; receive SMS/push alerts for frost, heat, heavy rain, and spray windows.

> [!TIP]
> Switch between English and Sesotho using the language toggle in the navigation bar. AI advice is translated point-by-point.

---

## Troubleshooting

| Problem | Likely cause | Solution |
|---------|--------------|----------|
| `LLM service not ready` | Model file missing | Place `mosupisi-q4.gguf` in `planting-guide-service/models/` or set `LLAMA_MODEL_PATH`. |
| `LLM service unreachable` (connection error) | LLM not started or wrong port | Ensure LLM runs on port 3004 and all other services have `LLM_SERVICE_URL=http://localhost:3004`. |
| Very slow first response | Embedding model & ChromaDB loading | Normal; wait 30-60 seconds. Subsequent requests are fast. |
| Frontend cannot connect | CORS or wrong `api.config.js` | Check that `ALLOWED_ORIGINS` includes `http://localhost:3000`. Verify frontend config points to correct ports. |
| Authentication fails | Profile service not running | Start profile service on port 8003. Check `SECRET_KEY` is set. |
| SMS not sent | Sandbox mode / no credentials | Development: set `SMS_STUB_FALLBACK=true`. Production: configure Africa's Talking credentials. |
| Port already in use | Another process occupies the port | Change the port in the service's `.env` or kill the blocking process. |
| Windows virtual environment not activating | Wrong path separator | Use `.venv\Scripts\activate` (backslash). |

### Quick diagnostic commands

```bash
curl http://localhost:3004/health
curl http://localhost:3001/health
curl http://localhost:8003/health
```

Also check that the LLM service log shows `Model found at: ...` on startup.

---

## Next Steps & Future Work

- **User acceptance testing** with Lesotho smallholder farmers and extension officers.
- **Sesotho language quality evaluation** by native speakers, refine translation prompts.
- **Frontend offline cache** for pest library and reports (IndexedDB).
- **Image-based pest identification** (requires labelled dataset for Lesotho crops).
- **Production deployment** using Docker Compose / Kubernetes.
- **Expand knowledge base** with Ministry of Agriculture soil health reports and extension manuals.

---

*Mosupisi - bridging the gap between AI and Lesotho's farmers.*