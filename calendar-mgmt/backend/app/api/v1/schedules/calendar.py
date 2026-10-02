from typing import Optional, List
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions
from app.core.constants import SCOPE_SELF, SCOPE_DEPARTMENT, RESPONSE_MESSAGES
from app.core.exceptions import ForbiddenError
from app.schemas.schedule import ScheduleResponse, CalendarResponse, CalendarCell
from app.models.schedule import Schedule
from app.core.constants import RESPONSE_MESSAGES
from app.services.coverage_service import check_coverage
from app.core.exceptions import BadRequestError
from app.clients.hr_client import hr_client
from app.models.shift_template import ShiftTemplate

router = APIRouter()


@router.get("/calendar", response_model=CalendarResponse)
async def get_calendar(
    month: str = Query(...),
    department_id: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    try:
        year, month_num = map(int, month.split("-"))
        month_start = date(year, month_num, 1)
        if month_num == 12:
            month_end = date(year + 1, 1, 1)
        else:
            month_end = date(year, month_num + 1, 1)
    except ValueError:
        raise BadRequestError(detail=RESPONSE_MESSAGES["INVALID_MONTH_FORMAT"])

    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_SELF:
        if not perms.get("can_read_schedule"):
            return CalendarResponse(month=month, department_id="", cells=[])
        employee_id = str(current_user.get("employee_id"))
    elif scope == SCOPE_DEPARTMENT:
        if not perms.get("can_read_schedule"):
            return CalendarResponse(month=month, department_id="", cells=[])
        user_dept = str(current_user.get("department_id")) if current_user.get("department_id") else None
        if department_id:
            if user_dept and any(d != user_dept for d in department_id):
                raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        elif user_dept:
            department_id = [user_dept]
    elif not perms.get("can_read_schedule"):
        return CalendarResponse(month=month, department_id="", cells=[])

    query = select(Schedule).where(
        Schedule.date >= month_start,
        Schedule.date < month_end,
    ).order_by(Schedule.date)

    if scope == SCOPE_SELF and employee_id:
        query = query.where(Schedule.employee_id == employee_id)

    result = await db.execute(query)
    schedules = result.scalars().all()

    shift_ids = list(set(str(s.shift_template_id) for s in schedules))
    shift_map = {}
    if shift_ids:
        shift_result = await db.execute(select(ShiftTemplate).where(ShiftTemplate.id.in_(shift_ids)))
        shift_map = {str(s.id): s for s in shift_result.scalars().all()}

    auth_token = current_user.get("_token", "")
    emp_ids = list(set(str(s.employee_id) for s in schedules))
    emp_map = await hr_client.get_employees_batch(emp_ids, token=auth_token) if emp_ids else {}

    wp_ids = list(set(str(s.workplace_id) for s in schedules if s.workplace_id))
    wp_data = await hr_client.get_workplaces_batch(wp_ids, token=auth_token) if wp_ids else {}
    wp_map = {wid: data.get("name", "") for wid, data in wp_data.items()}

    cells_dict = {}
    for s in schedules:
        day_key = s.date.isoformat()
        if day_key not in cells_dict:
            cells_dict[day_key] = CalendarCell(date=day_key, schedules=[])
        shift = shift_map.get(str(s.shift_template_id))
        emp = emp_map.get(str(s.employee_id))
        cells_dict[day_key].schedules.append(ScheduleResponse(
            id=str(s.id),
            employee_id=str(s.employee_id),
            shift_template_id=str(s.shift_template_id),
            workplace_id=str(s.workplace_id) if s.workplace_id else None,
            date=s.date,
            status=s.status.value if s.status else "draft",
            actual_start_time=s.actual_start_time,
            actual_end_time=s.actual_end_time,
            total_hours=s.total_hours,
            is_overtime=s.is_overtime,
            is_overtime_approved=s.is_overtime_approved,
            notes=s.notes,
            approved_by_id=str(s.approved_by_id) if s.approved_by_id else None,
            approved_at=s.approved_at,
            rejection_reason=s.rejection_reason,
            adjusted_from_id=str(s.adjusted_from_id) if s.adjusted_from_id else None,
            employee_name=emp.get("full_name") if emp else None,
            shift_name=shift.name if shift else None,
            shift_color=shift.color if shift else None,
            workplace_name=wp_map.get(str(s.workplace_id)) if s.workplace_id else None,
            department_name=emp.get("department_name") if emp else None,
            created_at=s.created_at,
        ))

    dept_id_str = ",".join(department_id) if department_id else ""
    return CalendarResponse(
        month=month,
        department_id=dept_id_str,
        cells=list(cells_dict.values()),
    )


@router.get("/coverage")
async def get_coverage(
    date: date = Query(...),
    department_id: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_SELF:
        if not perms.get("can_read_schedule"):
            return {"date": date.isoformat(), "total_shifts": 0, "gaps": [], "is_fully_covered": True, "covered_ranges": []}
    elif scope == SCOPE_DEPARTMENT:
        if not perms.get("can_read_schedule"):
            return {"date": date.isoformat(), "total_shifts": 0, "gaps": [], "is_fully_covered": True, "covered_ranges": []}
        user_dept = str(current_user.get("department_id")) if current_user.get("department_id") else None
        if department_id and user_dept and any(d != user_dept for d in department_id):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        if user_dept and not department_id:
            department_id = [user_dept]
    elif not perms.get("can_read_schedule"):
        return {"date": date.isoformat(), "total_shifts": 0, "gaps": [], "is_fully_covered": True, "covered_ranges": []}
    target_id = department_id[0] if department_id else None
    result = await check_coverage(db, target_id, date) if target_id else {"date": date.isoformat(), "total_shifts": 0, "gaps": [], "is_fully_covered": True, "covered_ranges": []}
    return result
