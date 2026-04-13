from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class PestTreatment(BaseModel):
    chemical: List[str] = []
    biological: List[str] = []
    cultural: List[str] = []
    treatment_st: List[str] = []


class Pest(BaseModel):
    id: str
    name: str
    name_st: str
    scientific_name: str
    crops: List[str]
    season: str
    severity: str  # low | medium | high
    description: str
    symptoms: List[str]
    symptoms_st: List[str]
    treatment: PestTreatment
    prevention: List[str]
    economic_threshold: str
    monitoring: str
    lesotho_context: str
    image_emoji: str


class PestSummary(BaseModel):
    """Lightweight version for list views."""
    id: str
    name: str
    name_st: str
    scientific_name: str
    crops: List[str]
    season: str
    severity: str
    image_emoji: str


class PestReport(BaseModel):
    id: Optional[str] = None
    user_id: str
    crop: str
    pest_name: str
    date_observed: date
    location: str
    severity: str  # low | medium | high
    action_taken: str
    notes: Optional[str] = ""
    status: str = "monitoring"  # monitoring | resolved
    created_at: Optional[datetime] = None


class PestReportCreate(BaseModel):
    user_id: str
    crop: str
    pest_name: str
    date_observed: date
    location: str
    severity: str
    action_taken: str
    notes: Optional[str] = ""

class PestReportResponse(BaseModel):
    id: int
    user_id: str
    pest_id: str
    crop_type: str
    severity: str
    location: str
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    reported_at: datetime
    status: str = "new"
    officer_notes: Optional[str] = None

    class Config:
        from_attributes = True

class PestReportUpdate(BaseModel):
    status: Optional[str] = None
    action_taken: Optional[str] = None
    notes: Optional[str] = None


class AskRequest(BaseModel):
    question: str
    language: Optional[str] = "en"  # en | st
    crop: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    relevant_pests: List[PestSummary] = []
    sources: List[str] = []


class GeneralTip(BaseModel):
    key: str
    en: str
    st: str