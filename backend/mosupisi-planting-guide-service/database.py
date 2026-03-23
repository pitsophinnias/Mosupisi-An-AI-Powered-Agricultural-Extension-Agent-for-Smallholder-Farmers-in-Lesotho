# database.py
# Mosupisi PlantingGuide Microservice – Database configuration
# Uses SQLite via SQLAlchemy 2.0 synchronous engine (simple, no extra deps).

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

# --------------------------------------------------------------------------
# Database URL – override via DATABASE_URL env var for production
# --------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./planting.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # needed for SQLite
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# --------------------------------------------------------------------------
# Dependency – FastAPI dependency injection
# --------------------------------------------------------------------------
def get_db():
    """Yield a database session and ensure it is closed after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------
# Init helper – called once on startup to create tables
# --------------------------------------------------------------------------
def init_db():
    """Create all tables defined in models.py if they do not exist."""
    import models  # noqa: F401 – import so SQLAlchemy registers the metadata
    Base.metadata.create_all(bind=engine)