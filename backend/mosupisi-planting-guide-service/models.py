# models.py
# Mosupisi PlantingGuide Microservice — SQLAlchemy 2.0 ORM Models

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base


class Planting(Base):
    """
    Represents a single crop planting record for a smallholder farmer.
    Matches the Dexie/IndexedDB schema in src/db/db.js exactly so that
    offline-first sync works without field-name mismatches.
    """
    __tablename__ = "plantings"

    id             = Column(Integer, primary_key=True, index=True, autoincrement=True)
    crop           = Column(String(50),  nullable=False)
    plantingDate   = Column(String(10),  nullable=False)
    area           = Column(String(100), nullable=True)
    location       = Column(String(200), nullable=True)
    status         = Column(String(50),  nullable=False, default="growing")
    growthStage    = Column(String(50),  nullable=True)
    lastAction     = Column(String(255), nullable=True)
    lastActionDate = Column(String(10),  nullable=True)
    notes          = Column(Text,        nullable=True)
    harvestDate    = Column(String(10),  nullable=True)
    yield_         = Column("yield", String(100), nullable=True)
    nextCrop       = Column(String(50),  nullable=True)
    soilPrep       = Column(Text,        nullable=True)
    createdAt      = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt      = Column(DateTime(timezone=True), server_default=func.now(),
                            onupdate=func.now())


class ActionLog(Base):
    """
    Persists every farm activity logged against a planting,
    together with the AI advice generated in response.
    """
    __tablename__ = "action_logs"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    planting_id  = Column(Integer, ForeignKey("plantings.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    action       = Column(Text, nullable=False)           # what the farmer did
    advice_en    = Column(Text, nullable=True)            # AI advice in English
    advice_st    = Column(Text, nullable=True)            # AI advice in Sesotho
    language     = Column(String(5), default="en")
    logged_at    = Column(DateTime(timezone=True), server_default=func.now())