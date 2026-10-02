from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    APP_NAME: str = "MBS Calendar Management"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mbs_calendar"

    # Shared SECRET_KEY with HR Core (App 1) for JWT validation
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Shared with HR Core - HR Core is the IDP that issues all tokens
    JWT_ISSUER: str = "mbs-hr"
    JWT_AUDIENCE: str = "mbs-hr-api"

    # HR Core API base URL (App 1) for cross-service communication
    HR_CORE_BASE_URL: str = "http://localhost:8000"

    FRONTEND_URL: str = "http://localhost:5173"

    LOG_LEVEL: str = "INFO"

    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_REFRESH: str = "10/minute"
    RATE_LIMIT_DEFAULT: str = "60/minute"

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
