from datetime import datetime, timedelta, timezone
from typing import Optional
import re
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings
from app.core.constants import TokenType
from app.core.exceptions import BadRequestError
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise BadRequestError(detail="Mật khẩu phải có ít nhất 8 ký tự")
    if not re.search(r"[A-Z]", password):
        raise BadRequestError(detail="Mật khẩu phải có ít nhất 1 chữ hoa")
    if not re.search(r"[a-z]", password):
        raise BadRequestError(detail="Mật khẩu phải có ít nhất 1 chữ thường")
    if not re.search(r"[0-9]", password):
        raise BadRequestError(detail="Mật khẩu phải có ít nhất 1 chữ số")


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = {
        "sub": user_id,
        "type": TokenType.ACCESS,
        "iat": datetime.now(timezone.utc),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    if expires_delta:
        to_encode["exp"] = datetime.now(timezone.utc) + expires_delta
    else:
        to_encode["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def create_refresh_token(user_id: str, expires_delta: Optional[timedelta] = None) -> tuple[str, str]:
    jti = str(uuid.uuid4())
    to_encode = {
        "sub": user_id,
        "type": TokenType.REFRESH,
        "jti": jti,
        "iat": datetime.now(timezone.utc),
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    }
    if expires_delta:
        to_encode["exp"] = datetime.now(timezone.utc) + expires_delta
    else:
        to_encode["exp"] = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256"), jti


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=["HS256"],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except JWTError:
        return None
