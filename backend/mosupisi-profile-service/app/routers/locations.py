from fastapi import APIRouter
from app.db.locations import DISTRICTS, LOCATIONS, FLAT_LIST

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/districts")
def list_districts():
    return {"districts": DISTRICTS}


@router.get("/towns")
def list_towns(district: str | None = None):
    if district:
        towns = LOCATIONS.get(district)
        return {"district": district, "towns": towns or []}
    return {"locations": FLAT_LIST}