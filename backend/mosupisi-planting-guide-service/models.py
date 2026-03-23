# models.py
# Mosupisi PlantingGuide Microservice – SQLAlchemy 2.0 ORM Models
# Project: Mosupisi – AI-Powered Agricultural Extension Agent for Lesotho
# Crops: maize, sorghum, legumes | Bilingual: English + Sesotho

from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from sqlalchemy.sql import func
from database import Base


class Planting(Base):
    """
    Represents a single crop planting record for a smallholder farmer.
    Matches the Dexie/IndexedDB schema in src/db/db.js exactly so that
    offline-first sync works without field-name mismatches.
    """
    __tablename__ = "plantings"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    crop          = Column(String(50),  nullable=False)          # maize | sorghum | legumes
    plantingDate  = Column(String(10),  nullable=False)          # ISO date YYYY-MM-DD
    area          = Column(String(100), nullable=True)           # free text, e.g. "2 hectares"
    location      = Column(String(200), nullable=True)           # field name / GPS description
    status        = Column(String(50),  nullable=False, default="growing")   # growing | harvested
    growthStage   = Column(String(50),  nullable=True)           # germination | vegetative | …
    lastAction    = Column(String(255), nullable=True)
    lastActionDate= Column(String(10),  nullable=True)           # ISO date YYYY-MM-DD
    notes         = Column(Text,        nullable=True)
    harvestDate   = Column(String(10),  nullable=True)
    yield_        = Column("yield", String(100), nullable=True)  # e.g. "800 kg"
    nextCrop      = Column(String(50),  nullable=True)
    soilPrep      = Column(Text,        nullable=True)
    createdAt     = Column(DateTime(timezone=True), server_default=func.now())
    updatedAt     = Column(DateTime(timezone=True), server_default=func.now(),
                           onupdate=func.now())