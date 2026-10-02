from datetime import date
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.schedule import Schedule
from app.core.constants import ScheduleStatus
from app.models.overtime_config import OvertimeConfig


async def check_overtime(db: AsyncSession, employee_id: UUID, schedule_date: date) -> dict:
    month_start = schedule_date.replace(day=1)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    result = await db.execute(
        select(func.sum(Schedule.total_hours)).where(
            Schedule.employee_id == employee_id,
            Schedule.date >= month_start,
            Schedule.date < month_end,
            Schedule.status.in_([ScheduleStatus.APPROVED, ScheduleStatus.CONFIRMED]),
        )
    )
    total = result.scalar() or 0.0

    ot_config = await db.execute(
        select(OvertimeConfig).where(OvertimeConfig.is_active == True).order_by(OvertimeConfig.effective_from.desc()).limit(1)
    )
    ot = ot_config.scalar_one_or_none()
    max_hours = ot.max_hours_per_month if ot else 180.0

    return {
        "total_hours": round(total, 2),
        "normal_hours": round(min(total, max_hours), 2),
        "overtime_hours": round(max(0, total - max_hours), 2),
        "max_hours": max_hours,
        "is_over": total > max_hours,
    }
