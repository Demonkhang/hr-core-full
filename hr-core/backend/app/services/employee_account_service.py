import re
import secrets
import unicodedata

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.models.user import User


def _remove_vietnamese_accents(s: str) -> str:
    s = s.replace('đ', 'd').replace('Đ', 'D')
    s = unicodedata.normalize('NFKD', s)
    return ''.join([c for c in s if not unicodedata.combining(c)])



async def auto_provision_user(
    db: AsyncSession,
    employee,
    password: str = None,
):
    existing = await db.execute(
        select(User).where(User.employee_id == employee.id)
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Nhân viên này đã có tài khoản")

    name_clean = _remove_vietnamese_accents(employee.full_name)
    username = employee.employee_code or employee.email or name_clean.lower().replace(" ", ".")
    username = re.sub(r'[^a-zA-Z0-9._-]', '', username)

    existing_username = await db.execute(
        select(User).where(User.username == username)
    )
    if existing_username.scalar_one_or_none():
        raise ConflictError(detail="Username đã tồn tại, hãy nhập username khác")

    if not password:
        password = secrets.token_urlsafe(8)

    user = User(
        username=username,
        email=employee.email or f"{username}@mbs.local",
        hashed_password=hash_password(password),
        full_name=employee.full_name,
        employee_id=employee.id,
        department_id=employee.department_id,
        must_change_password=True,
    )
    db.add(user)
    await db.flush()
    return user, password


async def reset_employee_password(
    db: AsyncSession,
    employee_id: str,
    new_password: str = None,
):
    result = await db.execute(
        select(User).where(User.employee_id == employee_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(detail="Nhân viên này chưa có tài khoản")

    if not new_password:
        new_password = secrets.token_urlsafe(8)

    user.hashed_password = hash_password(new_password)
    user.must_change_password = True
    await db.flush()
    return user, new_password
