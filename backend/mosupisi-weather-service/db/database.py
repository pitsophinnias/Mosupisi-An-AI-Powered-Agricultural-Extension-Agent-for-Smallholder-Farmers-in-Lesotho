"""
db/database.py - Async SQLite database layer.

Uses aiosqlite directly for simplicity. When you are ready to migrate to
PostgreSQL, swap the connection string in .env (DATABASE_URL) and replace
aiosqlite calls with asyncpg or SQLAlchemy async engine — the table schemas
are standard SQL and will work unchanged.

Tables
------
weather_cache   : Cached API responses keyed by (source, lat, lon, date)
weather_alerts  : Persisted alert records
"""

import aiosqlite
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

DB_PATH = Path(os.getenv("DATABASE_PATH", "data/weather.db"))


async def get_db() -> aiosqlite.Connection:
    """Dependency: yields an open aiosqlite connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    """Create tables if they don't exist yet."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS weather_cache (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                source      TEXT    NOT NULL,
                latitude    REAL    NOT NULL,
                longitude   REAL    NOT NULL,
                cache_key   TEXT    NOT NULL,
                payload     TEXT    NOT NULL,   -- JSON blob
                fetched_at  TEXT    NOT NULL,
                expires_at  TEXT    NOT NULL,
                UNIQUE(source, cache_key)
            );

            CREATE INDEX IF NOT EXISTS idx_cache_key
                ON weather_cache (source, cache_key);

            CREATE TABLE IF NOT EXISTS weather_alerts (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                farmer_id       TEXT,
                latitude        REAL    NOT NULL,
                longitude       REAL    NOT NULL,
                severity        TEXT    NOT NULL,
                title           TEXT    NOT NULL,
                message         TEXT    NOT NULL,
                source          TEXT    NOT NULL,
                triggered_at    TEXT    NOT NULL,
                status          TEXT    NOT NULL DEFAULT 'pending',
                sms_sent        INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_alerts_farmer
                ON weather_alerts (farmer_id);
        """)
        await db.commit()
        logger.info(f"SQLite DB initialised at {DB_PATH.resolve()}")
