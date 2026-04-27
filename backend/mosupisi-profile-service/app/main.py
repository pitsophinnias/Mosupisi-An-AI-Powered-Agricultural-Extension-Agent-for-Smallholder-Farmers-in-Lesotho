from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.db.database import Base, engine
from app.models import user, farm, otp
from app.routers import auth, profile, farms, locations

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Mosupisi Profile Service",
    description="Farmer/agent auth, profiles, farms, crops and pest sightings.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve uploaded avatars as static files ────────────────────────────────────
UPLOAD_DIR = Path("uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(farms.router)
app.include_router(locations.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": "mosupisi-profile-service"}