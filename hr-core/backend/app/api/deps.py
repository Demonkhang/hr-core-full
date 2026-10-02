from uuid import UUID
from typing import Optional
from fastapi import Depends, Request
from app.core.exceptions import UnauthorizedError, ForbiddenError
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.core.security import decode_token
from app.models.user import User
from app.models.employee import Employee
from app.models.position import Position
from app.core.constants import RESPONSE_MESSAGES, TokenType, SCOPE_ORGANIZATION, SCOPE_DEPARTMENT, SCOPE_SELF

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["UNAUTHENTICATED"])
    payload = decode_token(token)
    if not payload or payload.get("type") != TokenType.ACCESS:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_TOKEN"])

    sub = payload.get("sub")
    if not sub:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_TOKEN"])
    try:
        UUID(sub)
    except ValueError:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["INVALID_TOKEN"])
    result = await db.execute(select(User).where(User.id == sub))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["USER_NOT_FOUND"])
    request.state.user_id = str(user.id)
    return user


async def get_current_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if current_user.is_super_admin:
        return {
            "scope": SCOPE_ORGANIZATION,
            "can_manage_employees": True,
            "can_manage_departments": True,
            "can_manage_workplaces": True,
            "can_manage_settings": True,
            "can_manage_users": True,
            "can_view_reports": True,
        }

    if not current_user.employee_id:
        return {
            "scope": SCOPE_SELF,
            "can_manage_employees": False,
            "can_manage_departments": False,
            "can_manage_workplaces": False,
            "can_manage_settings": False,
            "can_manage_users": False,
            "can_view_reports": False,
        }

    result = await db.execute(
        select(Position)
        .join(Employee, Employee.position_id == Position.id)
        .where(Employee.id == current_user.employee_id)
    )
    pos = result.scalar_one_or_none()
    if not pos:
        return {
            "scope": SCOPE_SELF,
            "can_manage_employees": False,
            "can_manage_departments": False,
            "can_manage_workplaces": False,
            "can_manage_settings": False,
            "can_manage_users": False,
            "can_view_reports": False,
        }

    return {
        "scope": pos.scope,
        "can_manage_employees": pos.can_manage_employees,
        "can_manage_departments": pos.can_manage_departments,
        "can_manage_workplaces": pos.can_manage_workplaces,
        "can_manage_settings": pos.can_manage_settings,
        "can_manage_users": pos.can_manage_users,
        "can_view_reports": pos.can_view_reports,
    }


class RequirePermission:
    def __init__(self, perm: str):
        self.perm = perm

    async def __call__(self, perms: dict = Depends(get_current_permissions)) -> dict:
        if not perms.get(self.perm):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        return perms


def get_scope_filter(
    perms: dict,
    current_user: User,
) -> dict:
    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_ORGANIZATION:
        return {"scope": scope, "department_id": None, "employee_id": None}
    if scope == SCOPE_DEPARTMENT:
        return {"scope": scope, "department_id": str(current_user.department_id) if current_user.department_id else None, "employee_id": None}
    return {"scope": scope, "department_id": None, "employee_id": str(current_user.employee_id) if current_user.employee_id else None}
