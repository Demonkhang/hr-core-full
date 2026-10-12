from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, get_department_filter
from app.core.constants import SCOPE_ORGANIZATION, SCOPE_DEPARTMENT, SCOPE_SELF, RESPONSE_MESSAGES
from app.core.exceptions import ValidationError, ForbiddenError
from app.services import report_service

router = APIRouter()


def _parse_month(month: Optional[str]) -> Optional[date]:
    if not month:
        return None
    try:
        year, m = map(int, month.split("-"))
        return date(year, m, 1)
    except ValueError:
        raise ValidationError(detail="Định dạng tháng không hợp lệ. Sử dụng YYYY-MM")


def _parse_date(d: Optional[str], name: str) -> Optional[date]:
    if not d:
        return None
    try:
        return date.fromisoformat(d)
    except ValueError:
        raise ValidationError(detail=f"Định dạng {name} không hợp lệ. Sử dụng YYYY-MM-DD")


@router.get("/monthly-summary")
async def get_monthly_summary(
    employee_id: Optional[str] = Query(None),
    department_id: Optional[List[str]] = Query(None),
    month: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    if not perms.get("can_view_reports"):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_SELF:
        employee_id = str(current_user.get("employee_id"))
    elif scope == SCOPE_DEPARTMENT:
        user_dept = str(current_user.get("department_id")) if current_user.get("department_id") else None
        if department_id:
            if user_dept and any(d != user_dept for d in department_id):
                raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        elif user_dept:
            department_id = [user_dept]
    month_date = _parse_month(month)
    result = await report_service.get_monthly_summary(
        db,
        employee_id=employee_id,
        department_id=department_id,
        month=month_date,
    )
    return result


@router.get("/overtime")
async def get_overtime_report(
    department_id: Optional[List[str]] = Query(None),
    month: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    if not perms.get("can_view_reports"):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    scope = perms.get("scope", SCOPE_SELF)
    overtime_emp_id = None
    if scope == SCOPE_SELF:
        overtime_emp_id = current_user.get("employee_id")
    elif scope == SCOPE_DEPARTMENT:
        user_dept = str(current_user.get("department_id")) if current_user.get("department_id") else None
        if department_id:
            if user_dept and any(d != user_dept for d in department_id):
                raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        elif user_dept:
            department_id = [user_dept]
    month_date = _parse_month(month)
    result = await report_service.get_monthly_summary(
        db,
        employee_id=overtime_emp_id,
        department_id=department_id,
        month=month_date,
    )
    overtime_data = [r for r in result if r.get("overtime_hours", 0) > 0]
    return overtime_data


@router.get("/department-schedule-report")
async def get_department_schedule_report(
    date_from: str = Query(...),
    date_to: str = Query(...),
    department_id: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    if not perms.get("can_view_reports"):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    d_from = _parse_date(date_from, "date_from")
    d_to = _parse_date(date_to, "date_to")
    if not d_from or not d_to:
        raise ValidationError(detail="date_from và date_to là bắt buộc")
    if d_from > d_to:
        raise ValidationError(detail="date_from phải trước date_to")
    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_SELF:
        return []
    elif scope == SCOPE_DEPARTMENT:
        user_dept = str(current_user.get("department_id")) if current_user.get("department_id") else None
        if department_id:
            if user_dept and any(d != user_dept for d in department_id):
                raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        elif user_dept:
            department_id = [user_dept]

    result = await report_service.get_department_schedule_report(
        db,
        date_from=d_from,
        date_to=d_to,
        department_ids=department_id,
    )
    return result


@router.post("/monthly-summary/finalize")
async def finalize_monthly_summary(
    month: str = Query(..., description="Tháng dạng YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    if not perms.get("can_manage_settings") and not current_user.get("is_super_admin"):
        raise ForbiddenError(detail="Chỉ Quản trị viên mới có quyền chốt bảng công")
    month_date = _parse_month(month)
    if not month_date:
        raise ValidationError(detail="Tháng không hợp lệ")
    token = current_user.get("_token", "")
    return await report_service.finalize_monthly_summary(db, month=month_date, token=token)

