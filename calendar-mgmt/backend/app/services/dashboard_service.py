from datetime import date, timedelta
from typing import List, Optional
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.schedule import Schedule
from app.models.monthly_summary import MonthlySummary
from app.models.overtime_registration import OvertimeRegistration
from app.core.constants import ScheduleStatus
from app.clients.hr_client import hr_client

import logging

logger = logging.getLogger(__name__)


async def get_dashboard_stats(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
) -> dict:
    target_month = month or date.today().replace(day=1)
    today = date.today()

    today_sched = select(
        func.count(Schedule.id).label("total"),
        func.count(Schedule.id).filter(Schedule.status == ScheduleStatus.APPROVED).label("approved"),
        func.count(Schedule.id).filter(Schedule.status == ScheduleStatus.PENDING).label("pending"),
        func.count(Schedule.id).filter(Schedule.is_overtime == True).label("overtime"),
    ).where(Schedule.date == today)

    tr = (await db.execute(today_sched)).one()
    today_schedules = {
        "total": tr.total or 0,
        "approved": tr.approved or 0,
        "pending": tr.pending or 0,
        "overtime": tr.overtime or 0,
    }

    ms = select(
        func.coalesce(func.sum(MonthlySummary.total_hours), 0).label("th"),
        func.coalesce(func.sum(MonthlySummary.overtime_hours), 0).label("oh"),
        func.coalesce(func.sum(MonthlySummary.total_shifts), 0).label("ts"),
    ).where(MonthlySummary.month == target_month)
    mr = (await db.execute(ms)).one()
    month_summary = {
        "total_hours": float(mr.th),
        "overtime_hours": float(mr.oh),
        "total_shifts": int(mr.ts),
    }

    pending_schedules = (
        await db.execute(
            select(func.count(Schedule.id)).where(Schedule.status == ScheduleStatus.PENDING)
        )
    ).scalar() or 0

    pending_overtime = (
        await db.execute(
            select(func.count(OvertimeRegistration.id)).where(
                OvertimeRegistration.status == "pending",
                OvertimeRegistration.is_active == True,
            )
        )
    ).scalar() or 0

    # Fetch employee counts from HR Core
    total_employees = 0
    active_employees = 0
    try:
        all_employees = await hr_client.get_employees(active_only=False)
        total_employees = len(all_employees)
        active_employees = sum(
            1 for e in all_employees if e.get("is_active", True)
        )
    except Exception as e:
        logger.warning(f"Failed to fetch employee counts from HR Core: {e}")

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "total_schedules_today": today_schedules["total"],
        "today_schedules": today_schedules,
        "month_summary": month_summary,
        "pending_approvals": {
            "schedules": pending_schedules,
            "overtime": pending_overtime,
        },
    }


async def get_department_distribution(
    db: AsyncSession,
    department_ids: Optional[List[str]] = None,
) -> List[dict]:
    return []


async def get_monthly_trend(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
    months_back: int = 12,
) -> List[dict]:
    end_month = (month or date.today()).replace(day=1)
    start_month = end_month
    for _ in range(months_back - 1):
        start_month = (start_month - timedelta(days=1)).replace(day=1)

    query = select(
        MonthlySummary.month,
        func.coalesce(func.sum(MonthlySummary.total_hours), 0).label("total_hours"),
        func.coalesce(func.sum(MonthlySummary.overtime_hours), 0).label("overtime_hours"),
        func.coalesce(func.sum(MonthlySummary.total_shifts), 0).label("total_shifts"),
    ).where(
        MonthlySummary.month >= start_month,
        MonthlySummary.month <= end_month,
    )
    query = query.group_by(MonthlySummary.month).order_by(MonthlySummary.month)

    result = await db.execute(query)
    return [
        {
            "month": row.month.isoformat(),
            "total_hours": float(row.total_hours),
            "overtime_hours": float(row.overtime_hours),
            "total_shifts": int(row.total_shifts),
        }
        for row in result
    ]


def _month_end(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


async def get_schedule_by_status(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
) -> dict:
    target_month = (month or date.today()).replace(day=1)

    query = select(
        Schedule.status,
        func.count(Schedule.id).label("count"),
    ).where(
        Schedule.date >= target_month,
        Schedule.date < _month_end(target_month),
    )
    query = query.group_by(Schedule.status)

    result = await db.execute(query)
    counts: dict = {}
    for row in result:
        status_val = row.status.value if hasattr(row.status, "value") else row.status
        counts[status_val] = row.count
    for s in ScheduleStatus:
        counts.setdefault(s.value, 0)
    return counts


async def get_overtime_by_department(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
) -> List[dict]:
    target_month = (month or date.today()).replace(day=1)

    query = select(
        MonthlySummary.employee_id,
        func.coalesce(func.sum(MonthlySummary.overtime_hours), 0).label("total_ot_hours"),
    ).where(
        MonthlySummary.month == target_month,
    ).group_by(MonthlySummary.employee_id).having(
        func.sum(MonthlySummary.overtime_hours) > 0,
    )

    result = await db.execute(query)
    rows = result.all()

    if not rows:
        return []

    emp_ids = [str(row.employee_id) for row in rows]
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    # Aggregate overtime by department
    dept_ot: dict[str, float] = defaultdict(float)
    dept_names: dict[str, str] = {}

    for row in rows:
        emp = emp_map.get(str(row.employee_id))
        if emp and emp.get("department_id"):
            dept_id = str(emp["department_id"])
            dept_ot[dept_id] += float(row.total_ot_hours)
            if dept_id not in dept_names:
                dept_names[dept_id] = emp.get("department_name", "")
        else:
            # Group employees without department
            dept_ot["unknown"] += float(row.total_ot_hours)
            dept_names.setdefault("unknown", "Chưa phân bổ")

    # If department names are missing, try to fetch from HR Core
    missing_dept_ids = [
        did for did in dept_ot if did != "unknown" and not dept_names.get(did)
    ]
    for did in missing_dept_ids:
        try:
            dept = await hr_client.get_department(did)
            if dept:
                dept_names[did] = dept.get("name", f"Phòng ban {did[:8]}")
        except Exception:
            dept_names[did] = f"Phòng ban {did[:8]}"

    output = [
        {
            "department_id": dept_id,
            "department_name": dept_names.get(dept_id, f"Phòng ban {dept_id[:8]}"),
            "total_ot_hours": round(hours, 1),
        }
        for dept_id, hours in sorted(dept_ot.items(), key=lambda x: x[1], reverse=True)
    ]
    return output
