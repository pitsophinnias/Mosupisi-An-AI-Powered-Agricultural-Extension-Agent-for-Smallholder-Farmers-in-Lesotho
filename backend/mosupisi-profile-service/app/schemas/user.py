from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class UserProfileResponse(BaseModel):
    id: int
    full_name: str
    phone_number: str
    home_district: Optional[str]
    language: str
    role: str
    is_active: bool
    onboarding_complete: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    home_district: Optional[str] = None
    language: Optional[str] = None