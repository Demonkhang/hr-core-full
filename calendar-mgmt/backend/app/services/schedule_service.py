from datetime import date
from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.schedule import Schedule
from app.core.constants import ScheduleStatus, ChangeType
from app.clients.hr_client import hr_client
from app.models.shift_template import ShiftTemplate
from app.models.schedule_change_log import ScheduleChangeLog
from app.core.exceptions import NotFoundError, BadRequestError, ConflictError
from app.services.shift_utils import calculate_shift_hours
from app.services.overtime_service import check_overtime
from app.services.notification_service import create_notification


async def create_schedule(
    db: AsyncSession,
    employee_id: UUID,
    shift_template_id: UUID,
    workplace_id: UUID = None,
    schedule_date: date = None,
    notes: str = None,
    created_by: dict = None,
    auth_token: str = "",
    auto_approve: bool = False,
) -> Schedule:
    emp = await hr_client.get_employee(str(employee_id), token=auth_token)
    if not emp:
        raise NotFoundError("Không tìm thấy nhân viên")
    if not emp.get("is_active", True):
        raise BadRequestError("Nhân viên đã bị vô hiệu hóa")

    shift = await db.get(ShiftTemplate, shift_template_id)
    if not shift:
        raise NotFoundError("Không tìm thấy ca làm việc")

    from app.models.leave_registration import LeaveRegistration, LeaveRegistrationStatus
    leave_check = await db.execute(
        select(LeaveRegistration).where(
            LeaveRegistration.employee_id == employee_id,
            LeaveRegistration.start_date <= schedule_date,
            LeaveRegistration.end_date >= schedule_date,
            LeaveRegistration.status == LeaveRegistrationStatus.APPROVED,
            LeaveRegistration.is_active == True
        )
    )
    active_leave = leave_check.scalar_one_or_none()
    if active_leave:
        raise ConflictError("Nhân viên đang nghỉ phép trong ngày này")

    existing = await db.execute(
        select(Schedule).where(
            Schedule.employee_id == employee_id,
            Schedule.date == schedule_date,
            Schedule.shift_template_id == shift_template_id,
        )
    )
    existing_schedule = existing.scalar_one_or_none()
    if existing_schedule and existing_schedule.status != ScheduleStatus.CANCELLED:
        raise ConflictError("Nhân viên đã được phân ca trực này trong ngày")

    hours = calculate_shift_hours(shift.start_time, shift.end_time)

    created_by_id = str(created_by.get("id")) if created_by else None

    if existing_schedule:
        schedule = existing_schedule
        schedule.status = ScheduleStatus.APPROVED if auto_approve else ScheduleStatus.PENDING
        schedule.shift_template_id = shift_template_id
        schedule.workplace_id = workplace_id
        schedule.total_hours = hours
        schedule.notes = notes
        schedule.created_by_id = created_by_id
        schedule.actual_start_time = None
        schedule.actual_end_time = None
        schedule.approved_by_id = None
        schedule.approved_at = None
        schedule.rejection_reason = None
        schedule.is_overtime_approved = False
    else:
        schedule = Schedule(
            employee_id=employee_id,
            shift_template_id=shift_template_id,
            workplace_id=workplace_id,
            date=schedule_date,
            status=ScheduleStatus.APPROVED if auto_approve else ScheduleStatus.PENDING,
            total_hours=hours,
            notes=notes,
            created_by_id=created_by_id,
        )

    ot = await check_overtime(db, employee_id, schedule_date)
    schedule.is_overtime = ot["is_over"]

    if not existing_schedule:
        db.add(schedule)
    await db.flush()

    db.add(ScheduleChangeLog(
        schedule_id=schedule.id,
        changed_by_id=created_by_id,
        change_type=ChangeType.CREATE,
        new_values={
            "employee_id": str(employee_id),
            "shift_template_id": str(shift_template_id),
            "date": schedule_date.isoformat(),
            "total_hours": hours,
        },
    ))

    await create_notification(
        db,
        employee_id=str(employee_id),
        title="Lịch trực mới",
        message=f"Bạn được phân ca {shift.name} ngày {schedule_date.isoformat()} ({hours}h)",
        type="schedule_created",
        schedule_id=str(schedule.id),
    )

    await db.flush()
    return schedule


async def bulk_create_schedules(
    db: AsyncSession,
    items: list,
    department_id: UUID,
    created_by: dict = None,
    auth_token: str = "",
    auto_approve: bool = False,
) -> dict:
    created = []
    errors = []

    emp_ids = [item["employee_id"] for item in items]
    shift_ids = [item["shift_template_id"] for item in items]
    emp_map = await hr_client.get_employees_batch(emp_ids, token=auth_token)
    shift_result = await db.execute(select(ShiftTemplate).where(ShiftTemplate.id.in_(shift_ids)))
    shift_map = {str(s.id): s for s in shift_result.scalars().all()}

    for item in items:
        try:
            emp = emp_map.get(str(item["employee_id"]))
            shift = shift_map.get(str(item["shift_template_id"]))
            if not emp:
                raise NotFoundError("Không tìm thấy nhân viên")
            if not emp.get("is_active", True):
                raise BadRequestError("Nhân viên đã bị vô hiệu hóa")
            if not shift:
                raise NotFoundError("Không tìm thấy ca làm việc")

            async with db.begin_nested():
                schedule = await create_schedule(
                    db,
                    employee_id=item["employee_id"],
                    shift_template_id=item["shift_template_id"],
                    workplace_id=item.get("workplace_id"),
                    schedule_date=item["date"],
                    created_by=created_by,
                    auto_approve=auto_approve,
                )
                created.append(schedule)
        except Exception as e:
            errors.append({"item": item, "error": str(e)})

    await db.flush()
    return {"created": len(created), "errors": errors}
