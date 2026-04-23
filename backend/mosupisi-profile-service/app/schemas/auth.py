from pydantic import BaseModel, field_validator
from typing import Optional


class FarmerRegisterRequest(BaseModel):
    full_name: str
    phone_number: str
    password: str
    home_district: Optional[str] = None
    language: str = "en"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip()


class LoginRequest(BaseModel):
    phone_number: str
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    onboarding_complete: bool


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    phone_number: str


class ForgotPasswordResponse(BaseModel):
    message: str
    stub_otp: Optional[str] = None
    stub_sms_body: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    phone_number: str
    otp: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v