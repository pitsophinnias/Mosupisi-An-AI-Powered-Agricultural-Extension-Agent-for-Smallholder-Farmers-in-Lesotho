import logging
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationSettings, PushSubscription
from app.services.push import send_push
from app.services.sms import send_alert_sms

logger = logging.getLogger(__name__)

SMS_SEVERITIES = {"critical"}

PUSH_URLS = {
    "weather":      "/weather",
    "planting":     "/planting-guide",
    "pest":         "/pest-control",
    "spray_window": "/pest-control",
    "system":       "/",
}


def create_and_deliver(
    db: Session,
    farmer_id: int,
    type: str,
    severity: str,
    title: str,
    body: str,
    farm_id: int | None = None,
    farm_name: str | None = None,
    crop_id: str | None = None,
    farmer_phone: str | None = None,
) -> Notification | None:
    """
    Create a notification record and deliver via push + SMS
    based on farmer settings and severity.
    """
    # Get farmer settings (or use defaults if not set)
    settings_row = db.query(NotificationSettings).filter(
        NotificationSettings.farmer_id == farmer_id
    ).first()

    type_enabled_map = {
        "weather":      getattr(settings_row, "weather_alerts_enabled", True),
        "planting":     getattr(settings_row, "planting_reminders_enabled", True),
        "pest":         getattr(settings_row, "pest_alerts_enabled", True),
        "spray_window": getattr(settings_row, "spray_window_enabled", True),
        "system":       True,
    }

    if not type_enabled_map.get(type, True):
        logger.info(
            "Notification type '%s' disabled for farmer %s — skipping",
            type, farmer_id,
        )
        return None

    # Create DB record
    notif = Notification(
        farmer_id=farmer_id,
        type=type,
        severity=severity,
        title=title,
        body=body,
        farm_id=farm_id,
        farm_name=farm_name,
        crop_id=crop_id,
    )
    db.add(notif)
    db.flush()

    push_sent = False
    sms_sent  = False

    # Push notifications
    push_enabled = getattr(settings_row, "push_enabled", True)
    if push_enabled:
        subscriptions = db.query(PushSubscription).filter(
            PushSubscription.farmer_id == farmer_id,
            PushSubscription.is_active == True,
        ).all()
        for sub in subscriptions:
            ok = send_push(
                endpoint=sub.endpoint,
                p256dh=sub.p256dh,
                auth=sub.auth,
                title=title,
                body=body,
                severity=severity,
                url=PUSH_URLS.get(type, "/"),
            )
            if ok:
                push_sent = True

    # SMS — critical only
    sms_critical_enabled = getattr(settings_row, "sms_critical_enabled", True)
    if severity in SMS_SEVERITIES and sms_critical_enabled and farmer_phone:
        result = send_alert_sms(farmer_phone, title, body, severity)
        sms_sent = result.success

    notif.push_sent = push_sent
    notif.sms_sent  = sms_sent
    db.commit()
    db.refresh(notif)

    logger.info(
        "Notification created: farmer=%s type=%s severity=%s push=%s sms=%s — %s",
        farmer_id, type, severity, push_sent, sms_sent, title,
    )
    return notif