from typing import Optional, List
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission, check_scope_for_employee
from app.core.constants import SCOPE_ORGANIZATION, SCOPE_DEPARTMENT, SCOPE_SELF
from app.schemas.schedule import (
    ScheduleCreate, ScheduleUpdate, ScheduleResponse,
    BulkScheduleCreate,
)
from app.models.schedule import Schedule
from app.core.constants import ScheduleStatus, RESPONSE_MESSAGES
from app.models.shift_template import ShiftTemplate
from app.core.exceptions import NotFoundError, ValidationError, ForbiddenError
from app.services.schedule_service import create_schedule as create_schedule_service, bulk_create_schedules as bulk_schedules_service
from app.services.notification_service import create_notification
from app.clients.hr_client import hr_client

router = APIRouter()


def _schedule_to_response(s: Schedule, emp: dict = None, shift: dict = None, workplace_name: str = None, department_name: str = None) -> ScheduleResponse:
    shift_start = shift.get("start_time") if shift else None
    shift_end = shift.get("end_time") if shift else None
    return ScheduleResponse(
        id=str(s.id),
        employee_id=str(s.employee_id),
        shift_template_id=str(s.shift_template_id),
        workplace_id=str(s.workplace_id) if s.workplace_id else None,
        date=s.date,
        status=s.status.value if s.status else "draft",
        actual_start_time=s.actual_start_time or shift_start,
        actual_end_time=s.actual_end_time or shift_end,
        total_hours=s.total_hours,
        is_overtime=s.is_overtime,
        is_overtime_approved=s.is_overtime_approved,
        notes=s.notes,
        approved_by_id=str(s.approved_by_id) if s.approved_by_id else None,
        approved_at=s.approved_at,
        rejection_reason=s.rejection_reason,
        adjusted_from_id=str(s.adjusted_from_id) if s.adjusted_from_id else None,
        employee_name=emp.get("full_name") if emp else None,
        shift_name=shift.get("name") if shift else None,
        shift_color=shift.get("color") if shift else None,
        shift_start_time=shift_start,
        shift_end_time=shift_end,
        workplace_name=workplace_name,
        department_name=department_name,
        created_at=s.created_at,
    )


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    department_id: Optional[List[str]] = Query(None),
    employee_id: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    include_cancelled: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    if date_from and date_to and date_from > date_to:
        from app.core.exceptions import BadRequestError
        raise BadRequestError(detail="date_from phải trước hoặc bằng date_to")
    auth_token = current_user.get("_token", "")

    scope = perms.get("scope", SCOPE_SELF)
    if scope == SCOPE_SELF:
        if perms.get("can_read_schedule"):
            employee_id = str(current_user.get("employee_id"))
        else:
            return []
    elif scope == SCOPE_DEPARTMENT:
        if not perms.get("can_read_schedule"):
            return []
        user_dept = str(current_user.get("department_id")) if current_user.get("department_id") else None
        if department_id:
            if user_dept and any(d != user_dept for d in department_id):
                raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        elif user_dept:
            department_id = [user_dept]
    elif not perms.get("can_read_schedule"):
        return []

    query = select(Schedule)
    if not include_cancelled:
        query = query.where(Schedule.status != ScheduleStatus.CANCELLED)

    if employee_id:
        query = query.where(Schedule.employee_id == employee_id)
    if date_from:
        query = query.where(Schedule.date >= date_from)
    if date_to:
        query = query.where(Schedule.date <= date_to)
    if status:
        try:
            query = query.where(Schedule.status == ScheduleStatus(status))
        except ValueError:
            raise ValidationError(detail="Trạng thái không hợp lệ")

    query = query.order_by(Schedule.date, Schedule.created_at)
    result = await db.execute(query)
    schedules = result.scalars().all()

    auth_token = current_user.get("_token", "")
    emp_ids = list(set(str(s.employee_id) for s in schedules))
    shift_ids = list(set(str(s.shift_template_id) for s in schedules))
    emp_map = await hr_client.get_employees_batch(emp_ids, token=auth_token) if emp_ids else {}
    shift_result = await db.execute(select(ShiftTemplate).where(ShiftTemplate.id.in_(shift_ids)))
    shift_map = {str(s.id): s for s in shift_result.scalars().all()}

    wp_ids = list(set(str(s.workplace_id) for s in schedules if s.workplace_id))
    wp_data = await hr_client.get_workplaces_batch(wp_ids, token=auth_token) if wp_ids else {}
    wp_map = {wid: data.get("name", "") for wid, data in wp_data.items()}

    return [
        _schedule_to_response(
            s,
            emp=emp_map.get(str(s.employee_id)),
            shift={
                "name": shift_map[str(s.shift_template_id)].name,
                "color": shift_map[str(s.shift_template_id)].color,
                "start_time": shift_map[str(s.shift_template_id)].start_time,
                "end_time": shift_map[str(s.shift_template_id)].end_time,
            }
            if str(s.shift_template_id) in shift_map else None,
            workplace_name=wp_map.get(str(s.workplace_id)) if s.workplace_id else None,
            department_name=emp_map.get(str(s.employee_id), {}).get("department_name") if emp_map.get(str(s.employee_id)) else None,
        )
        for s in schedules
    ]


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise NotFoundError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    auth_token = current_user.get("_token", "")
    if not perms.get("can_read_schedule"):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    emp = await hr_client.get_employee(str(s.employee_id), token=auth_token)
    shift = await db.get(ShiftTemplate, s.shift_template_id)
    wp_name = None
    if s.workplace_id:
        wp = await hr_client.get_workplace(str(s.workplace_id), token=auth_token)
        wp_name = wp.get("name") if wp else None
    return _schedule_to_response(
        s,
        emp=emp,
        shift={
            "name": shift.name,
            "color": shift.color,
            "start_time": shift.start_time,
            "end_time": shift.end_time,
        } if shift else None,
        workplace_name=wp_name,
        department_name=emp.get("department_name") if emp else None,
    )


@router.post("", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    body: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_create_schedule')),
):
    auth_token = current_user.get("_token", "")
    if not await check_scope_for_employee(perms, current_user, body.employee_id, auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    schedule = await create_schedule_service(
        db,
        employee_id=body.employee_id,
        shift_template_id=body.shift_template_id,
        workplace_id=body.workplace_id,
        schedule_date=body.date,
        notes=body.notes,
        created_by=current_user,
        auth_token=auth_token,
        auto_approve=False,
    )
    emp = await hr_client.get_employee(body.employee_id, token=auth_token)
    shift = await db.get(ShiftTemplate, body.shift_template_id)
    wp_name = None
    if body.workplace_id:
        wp = await hr_client.get_workplace(body.workplace_id, token=auth_token)
        wp_name = wp.get("name") if wp else None
    return _schedule_to_response(
        schedule,
        emp=emp,
        shift={"name": shift.name, "color": shift.color} if shift else None,
        workplace_name=wp_name,
        department_name=emp.get("department_name") if emp else None,
    )


@router.post("/bulk-create")
async def bulk_create_schedules(
    body: BulkScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_create_schedule')),
):
    auth_token = current_user.get("_token", "")
    for item in body.schedules:
        if not await check_scope_for_employee(perms, current_user, item.employee_id, auth_token):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    items = [item.model_dump() for item in body.schedules]
    result = await bulk_schedules_service(db, items, body.department_id, current_user, auth_token=auth_token, auto_approve=False)
    return result


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: str,
    body: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_update_schedule')),
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise NotFoundError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    auth_token = current_user.get("_token", "")
    if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(s, key, value)
    await db.flush()

    shift_name = ""
    shift = await db.get(ShiftTemplate, s.shift_template_id)
    if shift:
        shift_name = shift.name

    await create_notification(
        db,
        employee_id=str(s.employee_id),
        title="Lịch trực thay đổi",
        message=f"Ca trực ngày {s.date.isoformat()} ({shift_name}) đã được cập nhật",
        type="schedule_updated",
        schedule_id=str(s.id),
    )

    await db.commit()
    auth_token = current_user.get("_token", "")
    emp = await hr_client.get_employee(str(s.employee_id), token=auth_token)
    wp_name = None
    if s.workplace_id:
        wp = await hr_client.get_workplace(str(s.workplace_id), token=auth_token)
        wp_name = wp.get("name") if wp else None
    return _schedule_to_response(
        s, emp=emp, shift={"name": shift.name, "color": shift.color} if shift else None,
        workplace_name=wp_name,
        department_name=emp.get("department_name") if emp else None,
    )


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_delete_schedule')),
):
    try:
        schedule_uuid = UUID(schedule_id)
    except ValueError:
        raise NotFoundError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    s = await db.get(Schedule, schedule_uuid)
    if not s:
        raise NotFoundError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    auth_token = current_user.get("_token", "")
    if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    s.status = ScheduleStatus.CANCELLED
    await db.flush()

    await create_notification(
        db,
        employee_id=str(s.employee_id),
        title="Lịch trực đã huỷ",
        message=f"Ca trực ngày {s.date.isoformat()} đã bị huỷ",
        type="schedule_cancelled",
        schedule_id=str(s.id),
    )

    await db.flush()
    return {"message": RESPONSE_MESSAGES["SCHEDULE_CANCELLED"]}


@router.delete("/date/{date}")
async def delete_schedules_by_date(
    date: date,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_delete_schedule')),
):
    auth_token = current_user.get("_token", "")
    result = await db.execute(select(Schedule).where(Schedule.date == date))
    schedules = result.scalars().all()
    for s in schedules:
        if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    if not schedules:
        raise NotFoundError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    count = 0
    for s in schedules:
        s.status = ScheduleStatus.CANCELLED
        await create_notification(
            db,
            employee_id=str(s.employee_id),
            title="Lịch trực đã huỷ",
            message=f"Ca trực ngày {s.date.isoformat()} đã bị huỷ",
            type="schedule_cancelled",
            schedule_id=str(s.id),
        )
        count += 1
    await db.flush()
    return {"message": f"Đã hủy {count} lịch làm việc ngày {date.isoformat()}"}
