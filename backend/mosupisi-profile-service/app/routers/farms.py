from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_farmer
from app.db.database import get_db
from app.db.locations import is_valid_district, get_district_for_town
from app.models.user import User
from app.models.farm import Farm, FarmCrop, PestSighting
from app.schemas.farm import (
    FarmCreate, FarmUpdate, FarmResponse,
    OnboardingRequest, PestSightingCreate, PestSightingResponse,
)

router = APIRouter(prefix="/farms", tags=["farms"])


def _validate_location(district: str, town: str) -> None:
    if not is_valid_district(district):
        raise HTTPException(status_code=422, detail=f"'{district}' is not a recognised district")
    inferred = get_district_for_town(town)
    if inferred is None:
        raise HTTPException(status_code=422, detail=f"'{town}' is not a recognised town")
    if inferred != district:
        raise HTTPException(status_code=422, detail=f"'{town}' belongs to {inferred}, not '{district}'")


def _get_owned_farm(farm_id: int, user: User, db: Session) -> Farm:
    farm = db.get(Farm, farm_id)
    if not farm or farm.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Farm not found")
    return farm


@router.post("/onboarding", response_model=list[FarmResponse], status_code=201)
def complete_onboarding(
    payload: OnboardingRequest,
    current_user: User = Depends(require_farmer),
    db: Session = Depends(get_db),
):
    if current_user.onboarding_complete:
        raise HTTPException(status_code=409, detail="Onboarding already completed. Use POST /farms instead.")

    created = []
    for farm_data in payload.farms:
        _validate_location(farm_data.district, farm_data.town)
        farm = Farm(owner_id=current_user.id, name=farm_data.name,
                    district=farm_data.district, town=farm_data.town)
        db.add(farm)
        db.flush()
        for crop_id in farm_data.crops:
            db.add(FarmCrop(farm_id=farm.id, crop_id=crop_id))
        created.append(farm)

    current_user.onboarding_complete = True
    db.commit()
    for f in created:
        db.refresh(f)
    return created


@router.get("/", response_model=list[FarmResponse])
def list_my_farms(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Farm).filter(Farm.owner_id == current_user.id, Farm.is_active == True).all()


@router.post("/", response_model=FarmResponse, status_code=201)
def create_farm(payload: FarmCreate, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    _validate_location(payload.district, payload.town)
    farm = Farm(owner_id=current_user.id, name=payload.name,
                district=payload.district, town=payload.town)
    db.add(farm)
    db.flush()
    for crop_id in payload.crops:
        db.add(FarmCrop(farm_id=farm.id, crop_id=crop_id))
    db.commit()
    db.refresh(farm)
    return farm


@router.get("/{farm_id}", response_model=FarmResponse)
def get_farm(farm_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned_farm(farm_id, current_user, db)


@router.patch("/{farm_id}", response_model=FarmResponse)
def update_farm(farm_id: int, payload: FarmUpdate, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    farm = _get_owned_farm(farm_id, current_user, db)
    if payload.name is not None:
        farm.name = payload.name.strip()
    if payload.district is not None or payload.town is not None:
        new_district = payload.district or farm.district
        new_town = payload.town or farm.town
        _validate_location(new_district, new_town)
        farm.district = new_district
        farm.town = new_town
    db.commit()
    db.refresh(farm)
    return farm


@router.delete("/{farm_id}", status_code=204)
def delete_farm(farm_id: int, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    farm = _get_owned_farm(farm_id, current_user, db)
    farm.is_active = False
    db.commit()


@router.post("/{farm_id}/crops/{crop_id}", status_code=201)
def add_crop(farm_id: int, crop_id: str, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    farm = _get_owned_farm(farm_id, current_user, db)
    if db.query(FarmCrop).filter(FarmCrop.farm_id == farm.id, FarmCrop.crop_id == crop_id).first():
        raise HTTPException(status_code=409, detail="Crop already on this farm")
    db.add(FarmCrop(farm_id=farm.id, crop_id=crop_id))
    db.commit()
    return {"message": f"Crop '{crop_id}' added to '{farm.name}'"}


@router.delete("/{farm_id}/crops/{crop_id}", status_code=204)
def remove_crop(farm_id: int, crop_id: str, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    farm = _get_owned_farm(farm_id, current_user, db)
    deleted = db.query(FarmCrop).filter(FarmCrop.farm_id == farm.id, FarmCrop.crop_id == crop_id).delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Crop not found on this farm")
    db.commit()


@router.post("/{farm_id}/pests", response_model=PestSightingResponse, status_code=201)
def report_pest(farm_id: int, payload: PestSightingCreate, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    farm = _get_owned_farm(farm_id, current_user, db)
    sighting = PestSighting(farm_id=farm.id, pest_name=payload.pest_name,
                            description=payload.description, severity=payload.severity)
    db.add(sighting)
    db.commit()
    db.refresh(sighting)
    return sighting


@router.get("/{farm_id}/pests", response_model=list[PestSightingResponse])
def list_pests(farm_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned_farm(farm_id, current_user, db).pest_sightings


@router.patch("/{farm_id}/pests/{pest_id}/resolve", response_model=PestSightingResponse)
def resolve_pest(farm_id: int, pest_id: int, current_user: User = Depends(require_farmer), db: Session = Depends(get_db)):
    farm = _get_owned_farm(farm_id, current_user, db)
    sighting = db.get(PestSighting, pest_id)
    if not sighting or sighting.farm_id != farm.id:
        raise HTTPException(status_code=404, detail="Pest sighting not found")
    sighting.resolved = True
    sighting.resolved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sighting)
    return sighting