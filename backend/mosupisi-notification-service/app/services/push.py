import json
import logging
from datetime import datetime, timezone
from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_quiet_hours() -> bool:
    now_hour = (datetime.now(timezone.utc).hour + 2) % 24  # CAT = UTC+2
    start = settings.QUIET_HOURS_START
    end = settings.QUIET_HOURS_END
    if start > end:
        return now_hour >= start or now_hour < end
    return start <= now_hour < end


def send_push(endpoint: str, p256dh: str, auth: str, title: str,
              body: str, severity: str = "info", url: str = "/") -> bool:
    if not settings.VAPID_PUBLIC_KEY or not settings.VAPID_PRIVATE_KEY:
        logger.warning("[PUSH STUB] Would push: %s — %s", title, body)
        return True

    if _is_quiet_hours():
        logger.info("[PUSH] Quiet hours — skipping: %s", title)
        return False

    try:
        from pywebpush import webpush

        icon_map = {
            "critical": "/icons/alert-critical.png",
            "warning":  "/icons/alert-warning.png",
            "info":     "/icons/icon-192x192.png",
        }

        payload = json.dumps({
            "title": title,
            "body": body,
            "icon": icon_map.get(severity, "/icons/icon-192x192.png"),
            "badge": "/icons/badge-72x72.png",
            "tag": f"mosupisi-{severity}",
            "url": url,
            "severity": severity,
        })

        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth},
            },
            data=payload,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
        )
        logger.info("[PUSH] Sent '%s'", title)
        return True

    except Exception as exc:
        logger.error("[PUSH] Failed: %s", exc)
        return False


def generate_vapid_keys() -> dict:
    try:
        from pywebpush import Vapid
        v = Vapid()
        v.generate_keys()
        return {
            "public_key": v.public_key.serialize().decode(),
            "private_key": v.private_key.serialize().decode(),
        }
    except Exception as exc:
        return {"error": str(exc)}