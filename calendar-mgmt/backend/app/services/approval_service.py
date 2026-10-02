from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schedule import Schedule
from app.core.constants import ScheduleStatus, ChangeType
from app.models.schedule_change_log import ScheduleChangeLog
from app.core.exceptions import NotFoundError, BadRequestError
from app.services.notification_service import create_notification


async def submit_for_approval(db: AsyncSession, schedule_id: UUID, user: dict) -> Schedule:
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise NotFoundError("Không tìm thấy lịch làm việc")
    if schedule.status not in (ScheduleStatus.DRAFT, ScheduleStatus.REJECTED):
        raise BadRequestError(f"Không thể gửi lịch ở trạng thái '{schedule.status.value}'")

    old_status = schedule.status.value
    schedule.status = ScheduleStatus.PENDING
    user_id = str(user.get("id")) if user else None

    db.add(ScheduleChangeLog(
        schedule_id=schedule.id,
        changed_by_id=user_id,
        change_type=ChangeType.SUBMIT,
        old_values={"status": old_status},
        new_values={"status": "pending"},
    ))
    await db.flush()
    return schedule


async def approve_schedule(db: AsyncSession, schedule_id: UUID, user: dict) -> Schedule:
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise NotFoundError("Không tìm thấy lịch làm việc")
    if schedule.status != ScheduleStatus.PENDING:
        raise BadRequestError("Chỉ có thể phê duyệt lịch đang chờ")

    old_status = schedule.status.value
    schedule.status = ScheduleStatus.APPROVED
    schedule.approved_by_id = user.get("id") if user else None
    schedule.approved_at = datetime.now(timezone.utc)

    db.add(ScheduleChangeLog(
        schedule_id=schedule.id,
        changed_by_id=user.get("id") if user else None,
        change_type=ChangeType.APPROVE,
        old_values={"status": old_status},
        new_values={"status": "approved"},
    ))

    await create_notification(
        db,
        employee_id=str(schedule.employee_id),
        title="Lịch trực đã duyệt",
        message=f"Ca trực ngày {schedule.date.isoformat()} đã được phê duyệt",
        type="schedule_approved",
        schedule_id=str(schedule.id),
    )

    await db.flush()
    return schedule


async def reject_schedule(db: AsyncSession, schedule_id: UUID, reason: str, user: dict) -> Schedule:
    schedule = await db.get(Schedule, schedule_id)
    if not schedule:
        raise NotFoundError("Không tìm thấy lịch làm việc")

    old_status = schedule.status.value
    schedule.status = ScheduleStatus.REJECTED
    schedule.rejection_reason = reason

    db.add(ScheduleChangeLog(
        schedule_id=schedule.id,
        changed_by_id=user.get("id") if user else None,
        change_type=ChangeType.REJECT,
        old_values={"status": old_status},
        new_values={"status": "rejected", "reason": reason},
        reason=reason,
    ))

    await create_notification(
        db,
        employee_id=str(schedule.employee_id),
        title="Lịch trực bị từ chối",
        message=f"Ca trực ngày {schedule.date.isoformat()} bị từ chối. Lý do: {reason}",
        type="schedule_rejected",
        schedule_id=str(schedule.id),
    )

    await db.flush()
    return schedule


async def bulk_approve_schedules(db: AsyncSession, schedule_ids: list[UUID], user: dict) -> tuple[list[Schedule], list[dict]]:
    approved = []
    errors = []
    result = await db.execute(select(Schedule).where(Schedule.id.in_(schedule_ids)))
    sched_map = {str(s.id): s for s in result.scalars().all()}
    for sid in schedule_ids:
        try:
            schedule = sched_map.get(str(sid))
            if not schedule:
                raise NotFoundError("Không tìm thấy lịch làm việc")
            if schedule.status != ScheduleStatus.PENDING:
                raise BadRequestError("Chỉ có thể phê duyệt lịch đang chờ")
            old_status = schedule.status.value
            schedule.status = ScheduleStatus.APPROVED
            schedule.approved_by_id = user.get("id") if user else None
            schedule.approved_at = datetime.now(timezone.utc)
            db.add(ScheduleChangeLog(
                schedule_id=schedule.id,
                changed_by_id=user.get("id") if user else None,
                change_type=ChangeType.APPROVE,
                old_values={"status": old_status},
                new_values={"status": "approved"},
            ))

            await create_notification(
                db,
                employee_id=str(schedule.employee_id),
                title="Lịch trực đã duyệt",
                message=f"Ca trực ngày {schedule.date.isoformat()} đã được phê duyệt",
                type="schedule_approved",
                schedule_id=str(schedule.id),
            )

            approved.append(schedule)
        except (NotFoundError, BadRequestError) as e:
            errors.append({"id": str(sid), "error": e.detail})
    return approved, errors


async def bulk_reject_schedules(db: AsyncSession, schedule_ids: list[UUID], reason: str, user: dict) -> tuple[list[Schedule], list[dict]]:
    rejected = []
    errors = []
    result = await db.execute(select(Schedule).where(Schedule.id.in_(schedule_ids)))
    sched_map = {str(s.id): s for s in result.scalars().all()}
    for sid in schedule_ids:
        try:
            schedule = sched_map.get(str(sid))
            if not schedule:
                raise NotFoundError("Không tìm thấy lịch làm việc")
            old_status = schedule.status.value
            schedule.status = ScheduleStatus.REJECTED
            schedule.rejection_reason = reason
            db.add(ScheduleChangeLog(
                schedule_id=schedule.id,
                changed_by_id=user.get("id") if user else None,
                change_type=ChangeType.REJECT,
                old_values={"status": old_status},
                new_values={"status": "rejected", "reason": reason},
                reason=reason,
            ))

            await create_notification(
                db,
                employee_id=str(schedule.employee_id),
                title="Lịch trực bị từ chối",
                message=f"Ca trực ngày {schedule.date.isoformat()} bị từ chối. Lý do: {reason}",
                type="schedule_rejected",
                schedule_id=str(schedule.id),
            )

            rejected.append(schedule)
        except (NotFoundError, BadRequestError) as e:
            errors.append({"id": str(sid), "error": e.detail})
    return rejected, errors
