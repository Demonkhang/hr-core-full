from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import os

_db_url = os.getenv("DATABASE_URL")
if _db_url and "localhost:5433" in _db_url:
    os.environ["DATABASE_URL"] = _db_url.replace("localhost:5433", "hr-db:5432")

class Settings(BaseSettings):
    APP_NAME: str = "HR Core"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mbs_hr"

    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    JWT_ISSUER: str = "mbs-hr"
    JWT_AUDIENCE: str = "mbs-hr-api"

    FRONTEND_URL: str = "http://localhost:5173"
    CALENDAR_MGMT_BASE_URL: str = "http://localhost:8002"

    LOG_LEVEL: str = "INFO"

    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REFRESH: str = "10/minute"
    RATE_LIMIT_DEFAULT: str = "60/minute"

    AUDIT_LOG_RETENTION_DAYS: int = 365

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        weak_keys = {"change-me", "secret", "changeme", "default", "test", "dev", "your-secret-key"}
        if not v or len(v) < 32:
            raise ValueError(
                "SECRET_KEY phải có ít nhất 32 ký tự. Hãy tạo key bằng: "
                "python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        if v.lower() in weak_keys:
            raise ValueError(
                f"SECRET_KEY '{v}' quá yếu/đoán được. Hãy dùng giá trị ngẫu nhiên."
            )
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
