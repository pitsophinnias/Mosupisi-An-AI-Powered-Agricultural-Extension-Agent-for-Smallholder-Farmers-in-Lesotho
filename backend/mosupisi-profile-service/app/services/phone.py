import re
import phonenumbers
from phonenumbers import PhoneNumberFormat, NumberParseException

_LESOTHO_CC = "LS"


def normalise_phone(raw: str) -> str:
    cleaned = re.sub(r"[\s\-\(\)\.]+", "", raw)
    try:
        parsed = phonenumbers.parse(cleaned, _LESOTHO_CC)
    except NumberParseException as exc:
        raise ValueError(f"Cannot parse phone number '{raw}': {exc}") from exc

    if not phonenumbers.is_valid_number(parsed):
        raise ValueError(
            f"'{raw}' is not a valid Lesotho phone number. "
            "Use format: 57123456 or +26657123456"
        )

    return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)