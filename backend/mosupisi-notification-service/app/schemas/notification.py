from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List


class NotificationResponse(BaseModel):
    id: int
    farmer_id: int
    type: str
    severity: str
    title: str
    body: str
    farm_id: Optional[int] = None
    farm_name: Optional[str] = None
    crop_id: Optional[str] = None
    is_read: bool
    push_sent: bool
    sms_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UnreadCountResponse(BaseModel):
    count: int


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class NotificationSettingsResponse(BaseModel):
    farmer_id: int
    weather_alerts_enabled: bool
    planting_reminders_enabled: bool
    pest_alerts_enabled: bool
    spray_window_enabled: bool
    sms_critical_enabled: bool
    push_enabled: bool
    quiet_hours_start: int
    quiet_hours_end: int

    model_config = {"from_attributes": True}


class NotificationSettingsUpdate(BaseModel):
    weather_alerts_enabled: Optional[bool] = None
    planting_reminders_enabled: Optional[bool] = None
    pest_alerts_enabled: Optional[bool] = None
    spray_window_enabled: Optional[bool] = None
    sms_critical_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None


class InternalWeatherAlert(BaseModel):
    farmer_id: int
    title: str
    body: str
    severity: str
    farm_id: Optional[int] = None
    farm_name: Optional[str] = None


class InternalPlantingAlert(BaseModel):
    farmer_id: int
    farm_id: int
    farm_name: str
    crop_id: str
    title: str
    body: str


class InternalPestAlert(BaseModel):
    farmer_id: int
    farm_id: int
    farm_name: str
    crop_id: str
    pest_name: str
    title: str
    body: str
    severity: str