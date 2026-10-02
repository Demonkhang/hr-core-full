from datetime import datetime, timedelta, timezone
from uuid import UUID
from app.core.exceptions import UnauthorizedError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.core.constants import RESPONSE_MESSAGES, TokenType

_DUMMY_HASH = hash_password("timing_attack_mitigation_dummy")


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        verify_password(password, _DUMMY_HASH)
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_CREDENTIALS"])
    if not verify_password(password, user.hashed_password):
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_CREDENTIALS"])
    if not user.is_active:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["ACCOUNT_DISABLED"])
    return user


async def create_tokens(db: AsyncSession, user: User, remember_me: bool = False) -> dict:
    if remember_me:
        access_expire = timedelta(days=7)
        refresh_expire = timedelta(days=30)
    else:
        access_expire = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        refresh_expire = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    access_token = create_access_token(str(user.id), expires_delta=access_expire)
    refresh_token_str, jti = create_refresh_token(str(user.id), expires_delta=refresh_expire)

    token_record = RefreshToken(
        user_id=user.id,
        token_jti=jti,
        expires_at=datetime.now(timezone.utc) + refresh_expire,
    )
    db.add(token_record)

    user.last_login = datetime.now(timezone.utc)
    await db.flush()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
    }


async def refresh_tokens(db: AsyncSession, refresh_token_str: str) -> dict:
    payload = decode_token(refresh_token_str)
    if not payload or payload.get("type") != TokenType.REFRESH:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_REFRESH"])

    jti = payload.get("jti")
    user_id = payload.get("sub")
    if not jti or not user_id:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_REFRESH"])

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_jti == jti,
            RefreshToken.is_revoked == False,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    token_record = result.scalar_one_or_none()
    if not token_record:
        await _revoke_all_user_tokens(db, user_id)
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["TOKEN_REVOKED"])

    token_record.is_revoked = True
    token_record.revoked_at = datetime.now(timezone.utc)

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["USER_NOT_FOUND"])

    new_access = create_access_token(str(user.id))
    new_refresh, new_jti = create_refresh_token(str(user.id))

    new_record = RefreshToken(
        user_id=user.id,
        token_jti=new_jti,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_record)
    token_record.replaced_by_jti = new_jti
    await db.flush()

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "must_change_password": user.must_change_password,
    }


async def revoke_token(db: AsyncSession, user_id: UUID):
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,
        )
    )
    tokens = result.scalars().all()
    now = datetime.now(timezone.utc)
    for t in tokens:
        t.is_revoked = True
        t.revoked_at = now
    await db.flush()


async def _revoke_all_user_tokens(db: AsyncSession, user_id: str):
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.is_revoked == False,
        )
    )
    now = datetime.now(timezone.utc)
    for t in result.scalars().all():
        t.is_revoked = True
        t.revoked_at = now
    await db.flush()
