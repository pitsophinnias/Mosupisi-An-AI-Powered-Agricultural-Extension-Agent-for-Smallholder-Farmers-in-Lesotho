import logging
import re
from dataclasses import dataclass
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SMSResult:
    success: bool
    stub_mode: bool = False
    stub_otp: str | None = None
    stub_sms_body: str | None = None
    error: str | None = None


class AfricasTalkingProvider:
    def __init__(self) -> None:
        try:
            import africastalking
            africastalking.initialize(
                username=settings.AT_USERNAME,
                api_key=settings.AT_API_KEY,
            )
            self._sms = africastalking.SMS
            self._available = True
        except Exception as exc:
            logger.warning("Africa's Talking init failed: %s", exc)
            self._available = False
            self._sms = None

    def send(self, to: str, body: str) -> SMSResult:
        if not self._available:
            return SMSResult(success=False, error="Africa's Talking not initialised")
        try:
            sender = settings.AT_SENDER_ID or None
            response = self._sms.send(body, [to], sender_id=sender)
            recipients = response.get("SMSMessageData", {}).get("Recipients", [])
            if recipients and recipients[0].get("status") == "Success":
                return SMSResult(success=True)
            error_msg = recipients[0].get("status", "Unknown") if recipients else "No recipients"
            return SMSResult(success=False, error=error_msg)
        except Exception as exc:
            return SMSResult(success=False, error=str(exc))


class StubSMSProvider:
    def send(self, to: str, body: str) -> SMSResult:
        logger.warning("[STUB SMS] To %s:\n%s", to, body)
        match = re.search(r"\b(\d{4,8})\b", body)
        otp = match.group(1) if match else None
        return SMSResult(success=True, stub_mode=True, stub_otp=otp, stub_sms_body=body)


_provider = None


def get_sms_provider():
    global _provider
    if _provider is None:
        at = AfricasTalkingProvider()
        if at._available:
            _provider = at
        elif settings.SMS_STUB_FALLBACK:
            logger.warning("Using StubSMSProvider — OTPs will appear in API responses")
            _provider = StubSMSProvider()
        else:
            raise RuntimeError("No SMS provider available")
    return _provider


def send_otp_sms(phone: str, otp: str) -> SMSResult:
    body = (
        f"Your Mosupisi verification code is: {otp}\n"
        f"It expires in {settings.OTP_EXPIRE_MINUTES} minutes. "
        "Do not share it with anyone."
    )
    return get_sms_provider().send(phone, body)