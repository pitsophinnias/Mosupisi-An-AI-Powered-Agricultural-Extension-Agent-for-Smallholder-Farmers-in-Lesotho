from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8004
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./mosupisi_notifications.db"

    PROFILE_SERVICE_URL: str = "http://localhost:8003"
    WEATHER_SERVICE_URL: str = "http://localhost:8002"

    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_CLAIMS_EMAIL: str = "mailto:admin@mosupisi.ls"

    AT_USERNAME: str = "sandbox"
    AT_API_KEY: str = "test"
    AT_SENDER_ID: str = "Mosupisi"
    AT_SANDBOX: bool = True
    SMS_STUB_FALLBACK: bool = True

    DAILY_CHECK_HOUR: int = 6
    DAILY_CHECK_MINUTE: int = 0

    FROST_THRESHOLD_C: float = 2.0
    HEAT_THRESHOLD_C: float = 35.0
    HEAVY_RAIN_MM: float = 20.0
    STRONG_WIND_MS: float = 10.0
    DROUGHT_DAYS: int = 7

    QUIET_HOURS_START: int = 21
    QUIET_HOURS_END: int = 6

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()