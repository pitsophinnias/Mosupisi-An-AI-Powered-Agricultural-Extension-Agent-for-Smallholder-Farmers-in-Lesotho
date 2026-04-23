from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
import bcrypt
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_token, generate_otp, otp_expiry,
)
from app.db.database import get_db
from app.models.user import User
from app.models.otp import OTPRecord
from app.schemas.auth import (
    FarmerRegisterRequest, LoginRequest, TokenResponse,
    RefreshRequest, ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest,
)
from app.services.phone import normalise_phone
from app.services.sms import send_otp_sms

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_otp(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_otp(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


@router.post("/register", status_code=201, response_model=TokenResponse)
def register_farmer(payload: FarmerRegisterRequest, db: Session = Depends(get_db)):
    try:
        phone = normalise_phone(payload.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if db.query(User).filter(User.phone_number == phone).first():
        raise HTTPException(status_code=409, detail="Account with this phone number already exists")

    user = User(
        full_name=payload.full_name,
        phone_number=phone,
        password_hash=hash_password(payload.password),
        home_district=payload.home_district,
        language=payload.language,
        role="farmer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
        user_id=user.id,
        role=user.role,
        onboarding_complete=user.onboarding_complete,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        phone = normalise_phone(payload.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user = db.query(User).filter(User.phone_number == phone).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect phone number or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role, remember_me=payload.remember_me),
        user_id=user.id,
        role=user.role,
        onboarding_complete=user.onboarding_complete,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)):
    token_data = decode_token(payload.refresh_token)
    if not token_data or token_data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = db.get(User, int(token_data["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
        user_id=user.id,
        role=user.role,
        onboarding_complete=user.onboarding_complete,
    )


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    try:
        phone = normalise_phone(payload.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user = db.query(User).filter(User.phone_number == phone).first()
    if not user:
        return ForgotPasswordResponse(
            message="If that number is registered, you will receive an OTP shortly."
        )

    otp_plain = generate_otp()

    # Invalidate previous unused OTPs
    db.query(OTPRecord).filter(
        OTPRecord.user_id == user.id, OTPRecord.used == False
    ).update({"used": True})

    db.add(OTPRecord(user_id=user.id, otp_hash=_hash_otp(otp_plain), expires_at=otp_expiry()))
    db.commit()

    result = send_otp_sms(phone, otp_plain)
    response = ForgotPasswordResponse(
        message="If that number is registered, you will receive an OTP shortly."
    )
    if result.stub_mode:
        response.stub_otp = result.stub_otp
        response.stub_sms_body = result.stub_sms_body

    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        phone = normalise_phone(payload.phone_number)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    user = db.query(User).filter(User.phone_number == phone).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    now = datetime.now(timezone.utc)
    record = (
        db.query(OTPRecord)
        .filter(OTPRecord.user_id == user.id, OTPRecord.used == False, OTPRecord.expires_at > now)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if not record or not _verify_otp(payload.otp, record.otp_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    user.password_hash = hash_password(payload.new_password)
    record.used = True
    db.commit()

    return {"message": "Password reset successfully. Please log in."}