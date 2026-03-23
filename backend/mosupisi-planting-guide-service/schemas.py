# schemas.py
# Mosupisi PlantingGuide Microservice – Pydantic v2 Schemas
# All date fields are ISO strings (YYYY-MM-DD) for seamless JSON ↔ Dexie sync.

from __future__ import annotations
from typing import Optional, List, Any, Dict
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Planting schemas
# ---------------------------------------------------------------------------

class PlantingBase(BaseModel):
    crop:           str             = Field(..., description="maize | sorghum | legumes")
    plantingDate:   str             = Field(..., description="ISO date YYYY-MM-DD")
    area:           Optional[str]   = None
    location:       Optional[str]   = None
    status:         str             = Field(default="growing")
    growthStage:    Optional[str]   = None
    lastAction:     Optional[str]   = None
    lastActionDate: Optional[str]   = None
    notes:          Optional[str]   = None
    harvestDate:    Optional[str]   = None
    yield_:         Optional[str]   = Field(default=None, alias="yield")
    nextCrop:       Optional[str]   = None
    soilPrep:       Optional[str]   = None

    model_config = ConfigDict(populate_by_name=True)


class PlantingCreate(PlantingBase):
    pass


class PlantingUpdate(BaseModel):
    """Used for PATCH-style updates (action logging, status changes)."""
    status:         Optional[str] = None
    growthStage:    Optional[str] = None
    lastAction:     Optional[str] = None
    lastActionDate: Optional[str] = None
    notes:          Optional[str] = None
    harvestDate:    Optional[str] = None
    yield_:         Optional[str] = Field(default=None, alias="yield")
    nextCrop:       Optional[str] = None
    soilPrep:       Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class PlantingOut(PlantingBase):
    """Full planting record returned to the React frontend, including computed fields."""
    id:                 int
    createdAt:          Optional[datetime] = None
    updatedAt:          Optional[datetime] = None
    # Computed server-side
    progressPercent:    float = 0.0
    currentStage:       str   = "unknown"
    daysSincePlanting:  int   = 0

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ---------------------------------------------------------------------------
# Action logging
# ---------------------------------------------------------------------------

class ActionRequest(BaseModel):
    action:    str  = Field(..., description="Description of the farm activity")
    language:  str  = Field(default="en", description="en | st")


# ---------------------------------------------------------------------------
# Advice / RAG
# ---------------------------------------------------------------------------

class AdviceRequest(BaseModel):
    language:    str             = Field(default="en", description="en | st")
    userContext: Dict[str, Any]  = Field(default_factory=dict)


class AdviceResponse(BaseModel):
    advice_en:              str
    advice_st:              str
    weather_outlook_en:     str
    weather_outlook_st:     str
    rotation_recommendation: Dict[str, Any]
    sources:                List[str]


# ---------------------------------------------------------------------------
# Crop rotation
# ---------------------------------------------------------------------------

class RotationEntry(BaseModel):
    next:        List[str]
    soilPrep:    str
    soilPrep_st: str
    reason:      str


class CropRotationResponse(BaseModel):
    maize:   RotationEntry
    sorghum: RotationEntry
    legumes: RotationEntry


# ---------------------------------------------------------------------------
# Weather context (extracted from Agromet Bulletin)
# ---------------------------------------------------------------------------

class WeatherContextResponse(BaseModel):
    bulletin_period:        str
    bulletin_number:        str
    season:                 str
    rainfall_summary_en:    str
    rainfall_summary_st:    str
    temperature_summary_en: str
    temperature_summary_st: str
    outlook_en:             str
    outlook_st:             str
    seasonal_outlook_en:    str
    seasonal_outlook_st:    str
    advisory_en:            str
    advisory_st:            str
    wsi_value:              str
    source:                 str


# ---------------------------------------------------------------------------
# Offline sync
# ---------------------------------------------------------------------------

class SyncRequest(BaseModel):
    plantings:          List[Dict[str, Any]] = Field(default_factory=list)
    lastSyncTimestamp:  Optional[str]        = None


class SyncResponse(BaseModel):
    synced:    int
    delta:     List[PlantingOut]
    timestamp: str


class DeltaResponse(BaseModel):
    delta:     List[PlantingOut]
    timestamp: str