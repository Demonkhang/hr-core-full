from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.models.monthly_summary import MonthlySummary
from app.models.schedule import Schedule
from app.models.shift_template import ShiftTemplate
from app.models.leave_registration import LeaveRegistration, LeaveType, LeaveRegistrationStatus
from app.core.constants import ScheduleStatus
from app.clients.hr_client import hr_client


async def get_monthly_summary(
    db: AsyncSession,
    employee_id: Optional[UUID] = None,
    department_id: Optional[List[str]] = None,
    month: Optional[date] = None,
) -> List[dict]:
    query = select(MonthlySummary)

    if employee_id:
        query = query.where(MonthlySummary.employee_id == employee_id)
    if month:
        query = query.where(MonthlySummary.month == month)

    result = await db.execute(query)
    summaries = result.scalars().all()

    emp_ids = list(set(str(s.employee_id) for s in summaries))
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    leave_query = (
        select(
            LeaveRegistration.employee_id,
            LeaveRegistration.leave_type,
            func.sum(LeaveRegistration.total_days).label("leave_days"),
        )
        .where(LeaveRegistration.status == LeaveRegistrationStatus.APPROVED)
    )
    if month:
        next_month = date(
            month.year + (month.month // 12),
            (month.month % 12) + 1,
            1,
        )
        leave_query = leave_query.where(
            LeaveRegistration.start_date < next_month,
            LeaveRegistration.end_date >= month,
        )
    leave_query = leave_query.group_by(
        LeaveRegistration.employee_id,
        LeaveRegistration.leave_type,
    )
    leave_result = await db.execute(leave_query)
    leave_rows = leave_result.all()

    leave_map: dict = {}
    for emp_id, ltype, days in leave_rows:
        emp_key = str(emp_id)
        if emp_key not in leave_map:
            leave_map[emp_key] = {"annual": 0.0, "other": 0.0}
        if ltype == LeaveType.ANNUAL.value:
            leave_map[emp_key]["annual"] += days
        else:
            leave_map[emp_key]["other"] += days

    data = []
    for s in summaries:
        emp_key = str(s.employee_id)
        emp = emp_map.get(emp_key, {})
        lv = leave_map.get(emp_key, {"annual": 0.0, "other": 0.0})
        data.append({
            "id": str(s.id),
            "employee_id": str(s.employee_id),
            "employee_name": emp.get("full_name") if emp else None,
            "department_id": str(emp.get("department_id")) if emp and emp.get("department_id") else None,
            "month": s.month.isoformat(),
            "total_hours": s.total_hours,
            "normal_hours": s.normal_hours,
            "overtime_hours": s.overtime_hours,
            "total_shifts": s.total_shifts,
            "annual_leave_days": lv["annual"],
            "other_leave_days": lv["other"],
            "is_finalized": s.is_finalized,
        })

    return data


async def get_department_schedule_report(
    db: AsyncSession,
    date_from: date,
    date_to: date,
    department_ids: Optional[List[str]] = None,
) -> List[dict]:
    query = (
        select(
            Schedule,
            ShiftTemplate,
        )
        .join(ShiftTemplate, Schedule.shift_template_id == ShiftTemplate.id)
        .where(Schedule.date.between(date_from, date_to))
        .where(Schedule.status != ScheduleStatus.DRAFT)
    )

    result = await db.execute(query)
    rows = result.all()

    emp_ids = list(set(str(row.Schedule.employee_id) for row in rows))
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    dept_map: dict = {}

    for schedule, shift_template in rows:
        emp = emp_map.get(str(schedule.employee_id), {})
        emp_id = str(schedule.employee_id)
        dept_id = str(emp.get("department_id")) if emp and emp.get("department_id") else "unknown"

        if dept_id not in dept_map:
            dept_map[dept_id] = {
                "department_id": dept_id,
                "department_name": emp.get("department_name", ""),
                "total_employees": 0,
                "total_shifts": 0,
                "total_hours": 0.0,
                "overtime_hours": 0.0,
                "employees": {},
            }

        dept = dept_map[dept_id]
        if emp_id not in dept["employees"]:
            dept["employees"][emp_id] = {
                "employee_id": emp_id,
                "employee_name": emp.get("full_name", ""),
                "total_shifts": 0,
                "total_hours": 0.0,
                "overtime_hours": 0.0,
                "schedules": [],
            }

        emp_data = dept["employees"][emp_id]
        shift_hours = schedule.total_hours or 0.0

        emp_data["total_shifts"] += 1
        emp_data["total_hours"] += shift_hours
        if schedule.is_overtime:
            emp_data["overtime_hours"] += shift_hours

        dept["total_shifts"] += 1
        dept["total_hours"] += shift_hours
        if schedule.is_overtime:
            dept["overtime_hours"] += shift_hours

        emp_data["schedules"].append({
            "id": str(schedule.id),
            "date": schedule.date.isoformat(),
            "shift_name": shift_template.name,
            "start_time": str(shift_template.start_time)[:5],
            "end_time": str(shift_template.end_time)[:5],
            "status": schedule.status.value,
            "total_hours": shift_hours,
            "is_overtime": schedule.is_overtime,
        })

    result_data = []
    for dept in dept_map.values():
        emp_list = list(dept["employees"].values())
        emp_list.sort(key=lambda e: e["employee_name"])
        dept["total_employees"] = len(emp_list)
        dept["employees"] = emp_list
        result_data.append(dept)

    result_data.sort(key=lambda d: d["department_name"])
    return result_data
