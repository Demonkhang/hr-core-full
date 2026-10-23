from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from app.models.schedule import Schedule
from app.models.monthly_summary import MonthlySummary
from app.models.overtime_registration import OvertimeRegistration
from app.core.constants import ScheduleStatus
from app.clients.hr_client import hr_client

import logging

logger = logging.getLogger(__name__)


def _month_end(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


async def _get_department_employee_ids(
    department_ids: Optional[List[str]],
    token: str = "",
) -> Optional[List[UUID]]:
    if not department_ids:
        return None
    try:
        employees = await hr_client.get_employees(active_only=False, token=token)
        target_depts = set(department_ids)
        emp_ids = [
            UUID(str(e["id"])) for e in employees
            if str(e.get("department_id")) in target_depts and e.get("id")
        ]
        return emp_ids
    except Exception as e:
        logger.warning(f"Failed to fetch employee list for department filter: {e}")
        return []


async def get_dashboard_stats(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
    token: str = "",
) -> dict:
    target_month = month or date.today().replace(day=1)
    today = date.today()
    start_date = target_month
    end_date = _month_end(target_month)

    emp_ids = await _get_department_employee_ids(department_ids, token=token)

    # 1. Today's schedules
    today_sched = select(
        func.count(Schedule.id).label("total"),
        func.count(Schedule.id).filter(Schedule.status == ScheduleStatus.APPROVED).label("approved"),
        func.count(Schedule.id).filter(Schedule.status == ScheduleStatus.PENDING).label("pending"),
        func.count(Schedule.id).filter(Schedule.is_overtime == True).label("overtime"),
    ).where(Schedule.date == today)
    if emp_ids is not None:
        today_sched = today_sched.where(Schedule.employee_id.in_(emp_ids))

    tr = (await db.execute(today_sched)).one()
    today_schedules = {
        "total": tr.total or 0,
        "approved": tr.approved or 0,
        "pending": tr.pending or 0,
        "overtime": tr.overtime or 0,
    }

    # 2. Month summary from Schedules (approved)
    sched_summary_query = select(
        func.coalesce(func.sum(Schedule.total_hours), 0).label("th"),
        func.coalesce(func.sum(case((Schedule.is_overtime == True, Schedule.total_hours), else_=0)), 0).label("oh"),
        func.count(Schedule.id).label("ts"),
    ).where(
        Schedule.date >= start_date,
        Schedule.date < end_date,
        Schedule.status == ScheduleStatus.APPROVED,
    )
    if emp_ids is not None:
        sched_summary_query = sched_summary_query.where(Schedule.employee_id.in_(emp_ids))
    sr = (await db.execute(sched_summary_query)).one()

    # Overtime registrations approved in this month
    ot_reg_query = select(
        func.coalesce(func.sum(OvertimeRegistration.total_hours), 0).label("reg_ot")
    ).where(
        OvertimeRegistration.date >= start_date,
        OvertimeRegistration.date < end_date,
        OvertimeRegistration.status == "approved",
        OvertimeRegistration.is_active == True,
    )
    if emp_ids is not None:
        ot_reg_query = ot_reg_query.where(OvertimeRegistration.employee_id.in_(emp_ids))
    ot_reg_hours = float((await db.execute(ot_reg_query)).scalar() or 0)

    # Fallback/merge with MonthlySummary if available
    ms_query = select(
        func.coalesce(func.sum(MonthlySummary.total_hours), 0).label("th"),
        func.coalesce(func.sum(MonthlySummary.overtime_hours), 0).label("oh"),
        func.coalesce(func.sum(MonthlySummary.total_shifts), 0).label("ts"),
    ).where(MonthlySummary.month == target_month)
    if emp_ids is not None:
        ms_query = ms_query.where(MonthlySummary.employee_id.in_(emp_ids))
    mr = (await db.execute(ms_query)).one()

    realtime_total_hours = float(sr.th) + ot_reg_hours
    realtime_ot_hours = float(sr.oh) + ot_reg_hours
    realtime_shifts = int(sr.ts)

    month_summary = {
        "total_hours": round(max(realtime_total_hours, float(mr.th)), 1),
        "overtime_hours": round(max(realtime_ot_hours, float(mr.oh)), 1),
        "total_shifts": max(realtime_shifts, int(mr.ts)),
    }

    # 3. Pending approvals
    pending_sched_query = select(func.count(Schedule.id)).where(Schedule.status == ScheduleStatus.PENDING)
    if emp_ids is not None:
        pending_sched_query = pending_sched_query.where(Schedule.employee_id.in_(emp_ids))
    pending_schedules = (await db.execute(pending_sched_query)).scalar() or 0

    pending_ot_query = select(func.count(OvertimeRegistration.id)).where(
        OvertimeRegistration.status == "pending",
        OvertimeRegistration.is_active == True,
    )
    if emp_ids is not None:
        pending_ot_query = pending_ot_query.where(OvertimeRegistration.employee_id.in_(emp_ids))
    pending_overtime = (await db.execute(pending_ot_query)).scalar() or 0

    # 4. Fetch employee counts from HR Core
    total_employees = 0
    active_employees = 0
    try:
        all_employees = await hr_client.get_employees(active_only=False, token=token)
        if department_ids:
            dept_set = set(department_ids)
            filtered = [e for e in all_employees if str(e.get("department_id")) in dept_set]
            total_employees = len(filtered)
            active_employees = sum(1 for e in filtered if e.get("is_active", True))
        else:
            total_employees = len(all_employees)
            active_employees = sum(1 for e in all_employees if e.get("is_active", True))
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
    token: str = "",
) -> List[dict]:
    try:
        all_employees = await hr_client.get_employees(active_only=False, token=token)
        dept_counts: dict[str, int] = defaultdict(int)
        dept_names: dict[str, str] = {}
        target_depts = set(department_ids) if department_ids else None

        for emp in all_employees:
            if not emp.get("is_active", True):
                continue
            d_id = str(emp.get("department_id") or "unknown")
            if target_depts and d_id not in target_depts:
                continue
            dept_counts[d_id] += 1
            if d_id not in dept_names:
                dept_names[d_id] = emp.get("department_name") or ("Chưa phân bổ" if d_id == "unknown" else f"Phòng ban {d_id[:8]}")

        return [
            {
                "department_id": d_id,
                "department_name": dept_names.get(d_id, d_id),
                "employee_count": count,
            }
            for d_id, count in sorted(dept_counts.items(), key=lambda x: x[1], reverse=True)
        ]
    except Exception as e:
        logger.warning(f"Failed to calculate department distribution: {e}")
        return []


async def get_monthly_trend(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
    months_back: int = 12,
    token: str = "",
) -> List[dict]:
    end_month = (month or date.today()).replace(day=1)
    emp_ids = await _get_department_employee_ids(department_ids, token=token)

    # Build sequence of months
    trend_months: List[date] = []
    for i in range(months_back - 1, -1, -1):
        y = end_month.year
        m = end_month.month - i
        while m <= 0:
            m += 12
            y -= 1
        trend_months.append(date(y, m, 1))

    trend_map = {
        m: {"total_hours": 0.0, "overtime_hours": 0.0, "total_shifts": 0}
        for m in trend_months
    }

    start_date = trend_months[0]
    end_date = _month_end(trend_months[-1])

    # 1. Query approved schedules in date range
    sched_query = select(
        Schedule.date,
        Schedule.total_hours,
        Schedule.is_overtime,
    ).where(
        Schedule.date >= start_date,
        Schedule.date < end_date,
        Schedule.status == ScheduleStatus.APPROVED,
    )
    if emp_ids is not None:
        sched_query = sched_query.where(Schedule.employee_id.in_(emp_ids))

    sched_rows = (await db.execute(sched_query)).all()
    for row in sched_rows:
        m_key = row.date.replace(day=1)
        if m_key in trend_map:
            h = float(row.total_hours or 0)
            trend_map[m_key]["total_hours"] += h
            trend_map[m_key]["total_shifts"] += 1
            if row.is_overtime:
                trend_map[m_key]["overtime_hours"] += h

    # 2. Query approved overtime registrations in date range
    ot_query = select(
        OvertimeRegistration.date,
        OvertimeRegistration.total_hours,
    ).where(
        OvertimeRegistration.date >= start_date,
        OvertimeRegistration.date < end_date,
        OvertimeRegistration.status == "approved",
        OvertimeRegistration.is_active == True,
    )
    if emp_ids is not None:
        ot_query = ot_query.where(OvertimeRegistration.employee_id.in_(emp_ids))

    ot_rows = (await db.execute(ot_query)).all()
    for row in ot_rows:
        m_key = row.date.replace(day=1)
        if m_key in trend_map:
            h = float(row.total_hours or 0)
            trend_map[m_key]["overtime_hours"] += h
            trend_map[m_key]["total_hours"] += h

    # 3. Also check MonthlySummary for finalized past months if any
    ms_query = select(
        MonthlySummary.month,
        func.coalesce(func.sum(MonthlySummary.total_hours), 0).label("th"),
        func.coalesce(func.sum(MonthlySummary.overtime_hours), 0).label("oh"),
        func.coalesce(func.sum(MonthlySummary.total_shifts), 0).label("ts"),
    ).where(
        MonthlySummary.month >= start_date,
        MonthlySummary.month <= trend_months[-1],
    )
    if emp_ids is not None:
        ms_query = ms_query.where(MonthlySummary.employee_id.in_(emp_ids))
    ms_query = ms_query.group_by(MonthlySummary.month)

    ms_rows = (await db.execute(ms_query)).all()
    for row in ms_rows:
        m_key = row.month
        if m_key in trend_map and trend_map[m_key]["total_hours"] == 0:
            trend_map[m_key]["total_hours"] = float(row.th)
            trend_map[m_key]["overtime_hours"] = float(row.oh)
            trend_map[m_key]["total_shifts"] = int(row.ts)

    return [
        {
            "month": m.isoformat(),
            "total_hours": round(trend_map[m]["total_hours"], 1),
            "overtime_hours": round(trend_map[m]["overtime_hours"], 1),
            "total_shifts": trend_map[m]["total_shifts"],
        }
        for m in trend_months
    ]


async def get_schedule_by_status(
    db: AsyncSession,
    month: Optional[date] = None,
    department_ids: Optional[List[str]] = None,
    token: str = "",
) -> dict:
    target_month = (month or date.today()).replace(day=1)
    emp_ids = await _get_department_employee_ids(department_ids, token=token)

    query = select(
        Schedule.status,
        func.count(Schedule.id).label("count"),
    ).where(
        Schedule.date >= target_month,
        Schedule.date < _month_end(target_month),
    )
    if emp_ids is not None:
        query = query.where(Schedule.employee_id.in_(emp_ids))

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
    token: str = "",
) -> List[dict]:
    target_month = (month or date.today()).replace(day=1)
    start_date = target_month
    end_date = _month_end(target_month)
    emp_ids_filter = await _get_department_employee_ids(department_ids, token=token)

    # 1. Overtime from Schedules
    emp_ot: dict[str, float] = defaultdict(float)

    sched_ot_query = select(
        Schedule.employee_id,
        func.coalesce(func.sum(Schedule.total_hours), 0).label("ot_h"),
    ).where(
        Schedule.date >= start_date,
        Schedule.date < end_date,
        Schedule.status == ScheduleStatus.APPROVED,
        Schedule.is_overtime == True,
    ).group_by(Schedule.employee_id)
    if emp_ids_filter is not None:
        sched_ot_query = sched_ot_query.where(Schedule.employee_id.in_(emp_ids_filter))

    sched_rows = (await db.execute(sched_ot_query)).all()
    for row in sched_rows:
        emp_ot[str(row.employee_id)] += float(row.ot_h)

    # 2. Overtime from OvertimeRegistration
    ot_reg_query = select(
        OvertimeRegistration.employee_id,
        func.coalesce(func.sum(OvertimeRegistration.total_hours), 0).label("ot_h"),
    ).where(
        OvertimeRegistration.date >= start_date,
        OvertimeRegistration.date < end_date,
        OvertimeRegistration.status == "approved",
        OvertimeRegistration.is_active == True,
    ).group_by(OvertimeRegistration.employee_id)
    if emp_ids_filter is not None:
        ot_reg_query = ot_reg_query.where(OvertimeRegistration.employee_id.in_(emp_ids_filter))

    ot_rows = (await db.execute(ot_reg_query)).all()
    for row in ot_rows:
        emp_ot[str(row.employee_id)] += float(row.ot_h)

    # 3. Fallback to MonthlySummary if available
    if not emp_ot:
        ms_query = select(
            MonthlySummary.employee_id,
            func.coalesce(func.sum(MonthlySummary.overtime_hours), 0).label("total_ot_hours"),
        ).where(
            MonthlySummary.month == target_month,
        ).group_by(MonthlySummary.employee_id).having(
            func.sum(MonthlySummary.overtime_hours) > 0,
        )
        if emp_ids_filter is not None:
            ms_query = ms_query.where(MonthlySummary.employee_id.in_(emp_ids_filter))
        for row in (await db.execute(ms_query)).all():
            emp_ot[str(row.employee_id)] += float(row.total_ot_hours)

    # Fetch employee list from HR Core to map departments
    emp_map = {}
    try:
        emp_list = await hr_client.get_employees(active_only=False, token=token)
        emp_map = {str(e["id"]): e for e in emp_list if e.get("id")}
    except Exception as e:
        logger.warning(f"Failed to fetch employee details for OT by department: {e}")

    # Aggregate by department
    dept_ot: dict[str, float] = defaultdict(float)
    dept_names: dict[str, str] = {}

    for eid_str, hours in emp_ot.items():
        if hours <= 0:
            continue
        emp = emp_map.get(eid_str)
        if emp and emp.get("department_id"):
            dept_id = str(emp["department_id"])
            dept_ot[dept_id] += hours
            if dept_id not in dept_names:
                dept_names[dept_id] = emp.get("department_name") or f"Phòng ban {dept_id[:8]}"
        else:
            dept_ot["unknown"] += hours
            dept_names.setdefault("unknown", "Chưa phân bổ")

    # If department filter was applied, filter dept_ot
    if department_ids:
        dept_ot = {k: v for k, v in dept_ot.items() if k in set(department_ids)}

    output = [
        {
            "department_id": dept_id,
            "department_name": dept_names.get(dept_id, f"Phòng ban {dept_id[:8]}"),
            "total_ot_hours": round(hours, 1),
        }
        for dept_id, hours in sorted(dept_ot.items(), key=lambda x: x[1], reverse=True)
    ]
    return output
