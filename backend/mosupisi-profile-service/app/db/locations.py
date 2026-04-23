DISTRICTS = [
    "Berea", "Butha-Buthe", "Leribe", "Mafeteng", "Maseru",
    "Mohale's Hoek", "Mokhotlong", "Qacha's Nek", "Quthing", "Thaba-Tseka",
]

LOCATIONS: dict[str, list[str]] = {
    "Berea": ["Teyateyaneng", "Mapoteng", "Bela Bela", "Kolonyama", "Peka"],
    "Butha-Buthe": ["Butha-Buthe", "Oxbow", "Moteng", "Letseng"],
    "Leribe": ["Hlotse", "Maputsoe", "Ficksburg Bridge", "Tsikoane"],
    "Mafeteng": ["Mafeteng", "Mohlanapeng", "Mekaling"],
    "Maseru": ["Maseru", "Thaba-Bosiu", "Roma", "Morija", "Nazareth", "Ha Abia"],
    "Mohale's Hoek": ["Mohale's Hoek", "Moyeni", "Mphaki"],
    "Mokhotlong": ["Mokhotlong", "Mapholaneng", "Sani Top", "Linakaneng"],
    "Qacha's Nek": ["Qacha's Nek", "Kotisephola"],
    "Quthing": ["Quthing", "Moyeni", "Palmietfontein"],
    "Thaba-Tseka": ["Thaba-Tseka", "Katse", "Semonkong", "Molumong"],
}

TOWN_TO_DISTRICT: dict[str, str] = {
    town: district
    for district, towns in LOCATIONS.items()
    for town in towns
}

FLAT_LIST = [
    {"district": district, "town": town}
    for district, towns in LOCATIONS.items()
    for town in towns
]


def get_district_for_town(town: str) -> str | None:
    return TOWN_TO_DISTRICT.get(town)

def is_valid_district(district: str) -> bool:
    return district in DISTRICTS

def is_valid_town(town: str) -> bool:
    return town in TOWN_TO_DISTRICT