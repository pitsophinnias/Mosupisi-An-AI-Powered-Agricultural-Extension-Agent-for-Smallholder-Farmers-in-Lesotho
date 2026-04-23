from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8003
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite:///./mosupisi_profile.db"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REMEMBER_ME_REFRESH_EXPIRE_DAYS: int = 30

    OTP_EXPIRE_MINUTES: int = 10
    OTP_LENGTH: int = 6

    AT_USERNAME: str = "sandbox"
    AT_API_KEY: str = "test"
    AT_SENDER_ID: str = "Mosupisi"
    AT_SANDBOX: bool = True

    SMS_STUB_FALLBACK: bool = True

    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()