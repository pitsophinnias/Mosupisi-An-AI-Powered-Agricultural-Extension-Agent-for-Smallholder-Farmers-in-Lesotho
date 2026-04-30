# tests/unit/test_profile_security.py
# Unit tests for mosupisi-profile-service security functions
# Run from: backend/mosupisi-profile-service
#   pytest tests/unit/test_profile_security.py -v

import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))


# ---------------------------------------------------------------------------
# bcrypt password hashing (KNOWN ISSUE #9: bcrypt+passlib incompatibility)
# ---------------------------------------------------------------------------

class TestPasswordHashing:
    """Tests that bcrypt direct calls work correctly (passlib was removed)."""

    def test_hash_returns_bytes(self):
        import bcrypt
        pwd = b"farmer123"
        hashed = bcrypt.hashpw(pwd, bcrypt.gensalt())
        assert isinstance(hashed, bytes)

    def test_correct_password_verifies(self):
        import bcrypt
        pwd = b"Lesotho@2026"
        hashed = bcrypt.hashpw(pwd, bcrypt.gensalt())
        assert bcrypt.checkpw(pwd, hashed) is True

    def test_wrong_password_fails(self):
        import bcrypt
        pwd = b"correct"
        hashed = bcrypt.hashpw(pwd, bcrypt.gensalt())
        assert bcrypt.checkpw(b"wrong", hashed) is False

    def test_empty_password_hashes(self):
        import bcrypt
        pwd = b""
        hashed = bcrypt.hashpw(pwd, bcrypt.gensalt())
        assert bcrypt.checkpw(pwd, hashed) is True

    def test_unicode_password_encoded(self):
        import bcrypt
        pwd = "Mosupisi🌱".encode("utf-8")
        hashed = bcrypt.hashpw(pwd, bcrypt.gensalt())
        assert bcrypt.checkpw(pwd, hashed) is True

    def test_two_hashes_of_same_password_differ(self):
        """bcrypt uses random salt — same password produces different hashes."""
        import bcrypt
        pwd = b"samepassword"
        h1 = bcrypt.hashpw(pwd, bcrypt.gensalt())
        h2 = bcrypt.hashpw(pwd, bcrypt.gensalt())
        assert h1 != h2


# ---------------------------------------------------------------------------
# Phone number normalisation
# ---------------------------------------------------------------------------

class TestPhoneNormalisation:
    """
    Profile service normalises phone numbers to E.164 (+266XXXXXXXX).
    Lesotho numbers: 8-digit starting with 5, 6, or 7.
    """

    def _normalise(self, number: str) -> str:
        """Replicate the normalisation logic from services/phone.py."""
        import re
        number = re.sub(r"[\s\-\(\)]", "", number)
        if number.startswith("+266"):
            return number
        if number.startswith("266"):
            return "+" + number
        if number.startswith("0") and len(number) == 9:
            return "+266" + number[1:]
        if len(number) == 8 and number[0] in "567":
            return "+266" + number
        return number  # return as-is if unrecognised

    def test_8_digit_lesotho_number(self):
        assert self._normalise("58001234") == "+26658001234"

    def test_leading_zero_format(self):
        assert self._normalise("058001234") == "+26658001234"

    def test_country_code_without_plus(self):
        assert self._normalise("26658001234") == "+26658001234"

    def test_already_e164(self):
        assert self._normalise("+26658001234") == "+26658001234"

    def test_spaces_stripped(self):
        assert self._normalise("5800 1234") == "+26658001234"

    def test_invalid_number_returned_as_is(self):
        result = self._normalise("12345")
        assert result == "12345"


# ---------------------------------------------------------------------------
# OTP generation
# ---------------------------------------------------------------------------

class TestOTPGeneration:

    def _gen_otp(self, length=6) -> str:
        import random
        return "".join([str(random.randint(0, 9)) for _ in range(length)])

    def test_otp_correct_length(self):
        assert len(self._gen_otp(6)) == 6

    def test_otp_is_digits_only(self):
        otp = self._gen_otp(6)
        assert otp.isdigit()

    def test_otp_custom_length(self):
        assert len(self._gen_otp(8)) == 8

    def test_otp_uniqueness(self):
        """Generate 100 OTPs — at least some should differ."""
        otps = {self._gen_otp(6) for _ in range(100)}
        assert len(otps) > 1

    def test_otp_hash_and_verify(self):
        import bcrypt
        otp = self._gen_otp(6)
        hashed = bcrypt.hashpw(otp.encode(), bcrypt.gensalt())
        assert bcrypt.checkpw(otp.encode(), hashed) is True


# ---------------------------------------------------------------------------
# JWT token structure (basic)
# ---------------------------------------------------------------------------

class TestJWTStructure:

    def test_token_has_three_parts(self):
        """A JWT has exactly 3 dot-separated parts."""
        import jwt, datetime
        payload = {
            "sub": "1",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        }
        token = jwt.encode(payload, "test-secret", algorithm="HS256")
        assert len(token.split(".")) == 3

    def test_token_decode_returns_sub(self):
        import jwt, datetime
        payload = {
            "sub": "42",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        }
        token = jwt.encode(payload, "test-secret", algorithm="HS256")
        decoded = jwt.decode(token, "test-secret", algorithms=["HS256"])
        assert decoded["sub"] == "42"

    def test_expired_token_raises(self):
        import jwt, datetime
        payload = {
            "sub": "1",
            "exp": datetime.datetime.utcnow() - datetime.timedelta(seconds=1)
        }
        token = jwt.encode(payload, "test-secret", algorithm="HS256")
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, "test-secret", algorithms=["HS256"])

    def test_wrong_secret_raises(self):
        import jwt, datetime
        payload = {
            "sub": "1",
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
        }
        token = jwt.encode(payload, "correct-secret", algorithm="HS256")
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "wrong-secret", algorithms=["HS256"])