from app.core.exceptions import ConflictError, BadRequestError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.core.constants import RESPONSE_MESSAGES


async def create_user(
    db: AsyncSession,
    username: str,
    email: str,
    password: str,
    full_name: str,
    is_super_admin: bool = False,
    employee_id: str = None,
    department_id: str = None,
) -> User:
    existing = await db.execute(
        select(User).where((User.username == username) | (User.email == email))
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail=RESPONSE_MESSAGES["DUPLICATE_CREDENTIALS"])

    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        is_super_admin=is_super_admin,
        employee_id=employee_id,
        department_id=department_id,
    )
    db.add(user)
    await db.flush()
    return user


async def change_password(
    db: AsyncSession,
    user: User,
    old_password: str,
    new_password: str,
):
    if not verify_password(old_password, user.hashed_password):
        raise BadRequestError(detail=RESPONSE_MESSAGES["WRONG_PASSWORD"])
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    await db.flush()
