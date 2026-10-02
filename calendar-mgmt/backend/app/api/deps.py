from uuid import UUID
from typing import Optional
from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.core.security import decode_token
from app.core.constants import RESPONSE_MESSAGES, TokenType, SCOPE_ORGANIZATION, SCOPE_DEPARTMENT, SCOPE_SELF
from app.clients.hr_client import hr_client
from app.database import get_db
from app.models.calendar_permission import CalendarPermission


async def get_current_user(request: Request, token: Optional[str] = None) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["UNAUTHENTICATED"])
    token = auth_header.split(" ", 1)[1]

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

    user = await hr_client.get_current_user(token)
    if not user:
        raise UnauthorizedError(detail=RESPONSE_MESSAGES["USER_NOT_FOUND"])

    user["_token"] = token
    request.state.user_id = str(user.get("id"))
    
    if not user.get("position_id") and user.get("employee_id"):
        emp = await hr_client.get_employee(str(user.get("employee_id")), token=token)
        if emp:
            if not user.get("department_id"):
                user["department_id"] = emp.get("department_id")
            user["position_id"] = emp.get("position_id")
            
    return user


def _hr_permission_keys():
    return ["can_manage_employees", "can_manage_departments", "can_manage_workplaces",
            "can_manage_settings", "can_manage_users", "can_view_reports"]


def _build_perms(scope: str, cal: dict) -> dict:
    return {"scope": scope, **{k: cal.get(k, False) for k in [
        "can_read_schedule", "can_create_schedule", "can_update_schedule",
        "can_delete_schedule", "can_approve_schedule", "can_manage_leave",
        "can_approve_leave", "can_manage_overtime", "can_approve_overtime",
        "can_manage_meetings", "can_approve_meetings",
    ]}, **{k: cal.get(k, False) for k in _hr_permission_keys()}}


async def get_current_permissions(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    is_super_admin = current_user.get("is_super_admin", False)
    
    hr_permissions = current_user.get("permissions") or current_user.get("position") or {}
    scope = hr_permissions.get("scope", SCOPE_SELF) if not is_super_admin else SCOPE_ORGANIZATION
    
    if is_super_admin:
        return _build_perms(SCOPE_ORGANIZATION, {
            "can_read_schedule": True, "can_create_schedule": True,
            "can_update_schedule": True, "can_delete_schedule": True,
            "can_approve_schedule": True, "can_manage_leave": True,
            "can_approve_leave": True, "can_manage_overtime": True,
            "can_approve_overtime": True, "can_manage_meetings": True,
            "can_approve_meetings": True,
            **{k: True for k in _hr_permission_keys()},
        })

    position_id = current_user.get("position_id")
    no_perm = _build_perms(scope, {})
    if not position_id:
        return no_perm

    try:
        pos_uuid = UUID(str(position_id))
    except (ValueError, TypeError):
        return no_perm

    result = await db.execute(
        select(CalendarPermission).where(
            CalendarPermission.position_id == pos_uuid,
            CalendarPermission.is_active == True,
        )
    )
    cal_perm = result.scalar_one_or_none()

    if not cal_perm:
        return no_perm

    return _build_perms(scope, {
        "can_read_schedule": cal_perm.can_read_schedule,
        "can_create_schedule": cal_perm.can_create_schedule,
        "can_update_schedule": cal_perm.can_update_schedule,
        "can_delete_schedule": cal_perm.can_delete_schedule,
        "can_approve_schedule": cal_perm.can_approve_schedule,
        "can_manage_leave": cal_perm.can_manage_leave,
        "can_approve_leave": cal_perm.can_approve_leave,
        "can_manage_overtime": cal_perm.can_manage_overtime,
        "can_approve_overtime": cal_perm.can_approve_overtime,
        "can_manage_meetings": cal_perm.can_manage_meetings,
        "can_approve_meetings": cal_perm.can_approve_meetings,
        **{k: hr_permissions.get(k, False) for k in _hr_permission_keys()},
    })


class RequirePermission:
    def __init__(self, perm: str):
        self.perm = perm

    async def __call__(self, perms: dict = Depends(get_current_permissions)) -> dict:
        if not perms.get(self.perm):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        return perms


class RequireScope:
    def __init__(self, target_department_id: Optional[str] = None, target_user_id: Optional[str] = None):
        self.target_department_id = target_department_id
        self.target_user_id = target_user_id

    async def __call__(
        self,
        perms: dict = Depends(get_current_permissions),
        current_user: dict = Depends(get_current_user),
    ) -> bool:
        if perms["scope"] == SCOPE_ORGANIZATION:
            return True
        if perms["scope"] == SCOPE_DEPARTMENT:
            if self.target_department_id and current_user.get("department_id"):
                return str(current_user["department_id"]) == self.target_department_id
            return True
        if perms["scope"] == SCOPE_SELF:
            if self.target_user_id:
                return str(current_user.get("id")) == self.target_user_id
            return True
        return False


async def check_scope_for_employee(
    perms: dict,
    current_user: dict,
    target_employee_id: str,
    token: str,
) -> bool:
    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_ORGANIZATION:
        return True
    if scope == SCOPE_DEPARTMENT:
        emp = await hr_client.get_employee(target_employee_id, token=token)
        if emp and current_user.get("department_id"):
            return str(emp.get("department_id")) == str(current_user["department_id"])
        return False
    if scope == SCOPE_SELF:
        return str(current_user.get("employee_id")) == str(target_employee_id)
    return False


def get_department_filter(perms: dict, current_user: dict) -> Optional[str]:
    if perms.get("scope") == SCOPE_ORGANIZATION:
        return None
    if perms.get("scope") == SCOPE_DEPARTMENT and current_user.get("department_id"):
        return str(current_user["department_id"])
    return None
