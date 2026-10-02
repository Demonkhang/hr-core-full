import logging
from typing import Optional
from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission, get_current_permissions
from app.models.employee import Employee
from app.models.user import User
from app.core.constants import RESPONSE_MESSAGES
from app.core.exceptions import NotFoundError
from app.services.employee_account_service import auto_provision_user, reset_employee_password
from app.services.audit_service import create_audit_log

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{emp_id}/create-account")
async def create_employee_account(
    emp_id: str,
    password: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    result = await db.execute(
        select(Employee).options(selectinload(Employee.department)).where(Employee.id == emp_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])

    user, generated_password = await auto_provision_user(db, emp, password)
    await db.flush()

    await create_audit_log(
        db, action="employee.create_account", resource_type="employee",
        resource_id=emp_id, user_id=str(current_user.id),
        new_values={"employee": emp.full_name, "username": user.username}, success=True,
    )

    return {
        "message": "Đã tạo tài khoản thành công",
        "user_id": str(user.id),
        "username": user.username,
        "password": generated_password if not password else None,
        "must_change_password": user.must_change_password,
    }


@router.post("/{emp_id}/reset-password")
async def reset_employee_password_endpoint(
    emp_id: str,
    new_password: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])

    user, generated_password = await reset_employee_password(db, emp_id, new_password)
    await db.flush()

    await create_audit_log(
        db, action="employee.reset_password", resource_type="employee",
        resource_id=emp_id, user_id=str(current_user.id),
        new_values={"employee": emp.full_name, "username": user.username}, success=True,
    )

    return {
        "message": "Đã reset mật khẩu thành công",
        "username": user.username,
        "new_password": generated_password if not new_password else None,
        "must_change_password": user.must_change_password,
    }
