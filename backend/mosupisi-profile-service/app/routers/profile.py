import os
import uuid
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserProfileResponse, UpdateProfileRequest

router = APIRouter(prefix="/profile", tags=["profile"])

# ── Upload directory ──────────────────────────────────────────────────────────
UPLOAD_DIR = Path("uploads/avatars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_SIZE_MB = 5


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


@router.post("/me/avatar", response_model=UserProfileResponse)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Only JPEG, PNG, and WebP images are allowed"
        )

    # Validate size
    contents = file.file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=422,
            detail=f"Image must be smaller than {MAX_SIZE_MB}MB"
        )
    file.file.seek(0)

    # Delete old avatar if it exists
    if current_user.avatar_url:
        old_filename = current_user.avatar_url.split("/uploads/avatars/")[-1]
        old_path = UPLOAD_DIR / old_filename
        if old_path.exists():
            old_path.unlink()

    # Save new file with unique name
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{current_user.id}_{uuid.uuid4().hex}.{ext}"
    dest = UPLOAD_DIR / filename

    with open(dest, "wb") as f:
        f.write(contents)

    # Update DB
    current_user.avatar_url = f"/uploads/avatars/{filename}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserProfileResponse)
def delete_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.avatar_url:
        raise HTTPException(status_code=404, detail="No avatar to delete")

    filename = current_user.avatar_url.split("/uploads/avatars/")[-1]
    path = UPLOAD_DIR / filename
    if path.exists():
        path.unlink()

    current_user.avatar_url = None
    db.commit()
    db.refresh(current_user)
    return current_user