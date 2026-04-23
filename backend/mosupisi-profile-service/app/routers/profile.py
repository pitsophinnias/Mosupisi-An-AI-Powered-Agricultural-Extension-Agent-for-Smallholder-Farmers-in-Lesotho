from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserProfileResponse, UpdateProfileRequest

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=UserProfileResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserProfileResponse)
def update_my_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.home_district is not None:
        current_user.home_district = payload.home_district
    if payload.language is not None:
        current_user.language = payload.language

    db.commit()
    db.refresh(current_user)
    return current_user