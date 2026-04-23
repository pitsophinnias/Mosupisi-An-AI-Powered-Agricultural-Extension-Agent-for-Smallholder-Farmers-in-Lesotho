from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import Optional


class FarmCropResponse(BaseModel):
    id: int
    crop_id: str
    added_at: datetime
    model_config = {"from_attributes": True}


class PestSightingCreate(BaseModel):
    pest_name: str
    description: Optional[str] = None
    severity: Optional[str] = None

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ("low", "medium", "high"):
            raise ValueError("Severity must be 'low', 'medium', or 'high'")
        return v


class PestSightingResponse(BaseModel):
    id: int
    pest_name: str
    description: Optional[str]
    severity: Optional[str]
    reported_at: datetime
    resolved: bool
    resolved_at: Optional[datetime]
    model_config = {"from_attributes": True}


class FarmCreate(BaseModel):
    name: str
    district: str
    town: str
    crops: list[str] = []

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Farm name cannot be empty")
        return v.strip()


class FarmUpdate(BaseModel):
    name: Optional[str] = None
    district: Optional[str] = None
    town: Optional[str] = None


class FarmResponse(BaseModel):
    id: int
    name: str
    district: str
    town: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    crops: list[FarmCropResponse] = []
    pest_sightings: list[PestSightingResponse] = []
    model_config = {"from_attributes": True}


class OnboardingRequest(BaseModel):
    farms: list[FarmCreate]

    @field_validator("farms")
    @classmethod
    def at_least_one_farm(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one farm must be provided")
        return v