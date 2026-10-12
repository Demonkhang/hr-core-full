import logging
from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

logger = logging.getLogger(__name__)
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
    if not month:
        today = date.today()
        month = date(today.year, today.month, 1)

    next_month = date(
        month.year + (month.month // 12),
        (month.month % 12) + 1,
        1,
    )

    # 1. Fetch existing MonthlySummary records from DB if any
    ms_query = select(MonthlySummary).where(MonthlySummary.month == month)
    if employee_id:
        ms_query = ms_query.where(MonthlySummary.employee_id == employee_id)
    ms_res = await db.execute(ms_query)
    ms_map = {str(s.employee_id): s for s in ms_res.scalars().all()}

    # 2. Fetch Schedules for the month to dynamically calculate totals
    sched_query = (
        select(Schedule)
        .where(Schedule.date >= month, Schedule.date < next_month)
        .where(Schedule.status != ScheduleStatus.DRAFT)
    )
    if employee_id:
        sched_query = sched_query.where(Schedule.employee_id == employee_id)
    
    sched_res = await db.execute(sched_query)
    schedules = sched_res.scalars().all()

    emp_sched_map: dict = {}
    for s in schedules:
        emp_key = str(s.employee_id)
        if emp_key not in emp_sched_map:
            emp_sched_map[emp_key] = {
                "total_shifts": 0,
                "total_hours": 0.0,
                "overtime_hours": 0.0,
            }
        sh = s.total_hours or 0.0
        emp_sched_map[emp_key]["total_shifts"] += 1
        emp_sched_map[emp_key]["total_hours"] += sh
        if s.is_overtime:
            emp_sched_map[emp_key]["overtime_hours"] += sh

    all_emp_ids = list(set(list(ms_map.keys()) + list(emp_sched_map.keys())))
    if not all_emp_ids:
        return []

    emp_map = await hr_client.get_employees_batch(all_emp_ids) if all_emp_ids else {}

    # 3. Query LeaveRegistrations for the month
    leave_query = (
        select(
            LeaveRegistration.employee_id,
            LeaveRegistration.leave_type,
            func.sum(LeaveRegistration.total_days).label("leave_days"),
        )
        .where(
            LeaveRegistration.status == LeaveRegistrationStatus.APPROVED,
            LeaveRegistration.start_date < next_month,
            LeaveRegistration.end_date >= month,
        )
        .group_by(
            LeaveRegistration.employee_id,
            LeaveRegistration.leave_type,
        )
    )
    if employee_id:
        leave_query = leave_query.where(LeaveRegistration.employee_id == employee_id)

    leave_result = await db.execute(leave_query)
    leave_rows = leave_result.all()

    leave_map: dict = {}
    for emp_id_val, ltype, days in leave_rows:
        emp_key = str(emp_id_val)
        if emp_key not in leave_map:
            leave_map[emp_key] = {"annual": 0.0, "other": 0.0}
        if ltype == LeaveType.ANNUAL.value:
            leave_map[emp_key]["annual"] += float(days or 0)
        else:
            leave_map[emp_key]["other"] += float(days or 0)

    data = []
    for emp_key in all_emp_ids:
        emp = emp_map.get(emp_key, {}) or {}
        emp_dept_id = str(emp.get("department_id")) if emp.get("department_id") else None

        if department_id and emp_dept_id not in department_id:
            continue

        ms_rec = ms_map.get(emp_key)
        sched_stats = emp_sched_map.get(emp_key, {"total_shifts": 0, "total_hours": 0.0, "overtime_hours": 0.0})
        lv = leave_map.get(emp_key, {"annual": 0.0, "other": 0.0})

        if ms_rec:
            tot_h = ms_rec.total_hours
            norm_h = ms_rec.normal_hours
            ot_h = ms_rec.overtime_hours
            tot_shifts = ms_rec.total_shifts
            is_fin = ms_rec.is_finalized
            rec_id = str(ms_rec.id)
        else:
            tot_h = sched_stats["total_hours"]
            ot_h = sched_stats["overtime_hours"]
            norm_h = max(0.0, tot_h - ot_h)
            tot_shifts = sched_stats["total_shifts"]
            is_fin = False
            rec_id = f"dyn-{emp_key}"

        data.append({
            "id": rec_id,
            "employee_id": emp_key,
            "employee_name": emp.get("full_name") or f"Nhân viên ({emp_key[:8]})",
            "department_id": emp_dept_id,
            "department_name": emp.get("department_name") or "Ban Quản lý",
            "month": month.isoformat(),
            "total_hours": round(tot_h, 1),
            "normal_hours": round(norm_h, 1),
            "overtime_hours": round(ot_h, 1),
            "total_shifts": tot_shifts,
            "annual_leave_days": lv["annual"],
            "other_leave_days": lv["other"],
            "is_finalized": is_fin,
        })

    data.sort(key=lambda x: x["employee_name"])
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

    wp_ids = list(set(str(row.Schedule.workplace_id) for row in rows if row.Schedule.workplace_id))
    wp_map = await hr_client.get_workplaces_batch(wp_ids) if wp_ids else {}

    dept_map: dict = {}

    for schedule, shift_template in rows:
        emp = emp_map.get(str(schedule.employee_id), {}) or {}
        emp_id = str(schedule.employee_id)
        dept_id = str(emp.get("department_id")) if emp and emp.get("department_id") else "unknown"

        dept_name = emp.get("department_name") or ("Ban Quản lý" if dept_id == "unknown" else f"Phòng {dept_id[:8]}")
        emp_name = emp.get("full_name") or f"Nhân viên ({emp_id[:8]})"
        wp_name = wp_map.get(str(schedule.workplace_id), {}).get("name") if schedule.workplace_id else "Trụ sở chính"

        if dept_id not in dept_map:
            dept_map[dept_id] = {
                "department_id": dept_id,
                "department_name": dept_name,
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
                "employee_name": emp_name,
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
            "workplace_name": wp_name,
            "status": schedule.status.value,
            "total_hours": shift_hours,
            "is_overtime": schedule.is_overtime,
        })

    result_data = []
    for dept in dept_map.values():
        if department_ids and dept["department_id"] not in department_ids:
            continue
        emp_list = list(dept["employees"].values())
        emp_list.sort(key=lambda e: e["employee_name"])
        dept["total_employees"] = len(emp_list)
        dept["employees"] = emp_list
        result_data.append(dept)

    result_data.sort(key=lambda d: d["department_name"])
    return result_data


async def finalize_monthly_summary(
    db: AsyncSession,
    month: date,
    token: str = "",
) -> dict:
    from app.core.exceptions import BadRequestError
    from app.models.overtime_registration import OvertimeRegistration, OvertimeStatus
    import httpx
    from app.config import settings

    next_month = date(
        month.year + (month.month // 12),
        (month.month % 12) + 1,
        1,
    )

    # Check for pending schedules
    sched_stmt = select(Schedule).where(
        Schedule.date >= month,
        Schedule.date < next_month,
        Schedule.status == ScheduleStatus.PENDING,
    )
    sched_res = await db.execute(sched_stmt)
    if sched_res.scalars().first():
        raise BadRequestError("Vẫn còn lịch trực ở trạng thái CHỜ DUYỆT trong tháng này. Vui lòng xử lý trước khi chốt công.")

    # Check for pending leaves
    leave_stmt = select(LeaveRegistration).where(
        LeaveRegistration.start_date < next_month,
        LeaveRegistration.end_date >= month,
        LeaveRegistration.status == LeaveRegistrationStatus.PENDING,
    )
    leave_res = await db.execute(leave_stmt)
    if leave_res.scalars().first():
        raise BadRequestError("Vẫn còn đơn xin nghỉ phép CHỜ DUYỆT trong tháng này. Vui lòng xử lý trước khi chốt công.")

    # Check for pending OT
    ot_stmt = select(OvertimeRegistration).where(
        OvertimeRegistration.date >= month,
        OvertimeRegistration.date < next_month,
        OvertimeRegistration.status == OvertimeStatus.PENDING,
    )
    ot_res = await db.execute(ot_stmt)
    if ot_res.scalars().first():
        raise BadRequestError("Vẫn còn đơn đăng ký OT CHỜ DUYỆT trong tháng này. Vui lòng xử lý trước khi chốt công.")

    # Get summaries for month
    summary_stmt = select(MonthlySummary).where(MonthlySummary.month == month)
    summary_res = await db.execute(summary_stmt)
    summaries = summary_res.scalars().all()

    for s in summaries:
        s.is_finalized = True

    await db.commit()

    # Get enriched report data to send to HR Core
    report_data = await get_monthly_summary(db, month=month)

    # Post to HR Core payroll endpoint
    try:
        url = f"{settings.HR_CORE_BASE_URL.rstrip('/')}/api/v1/payroll/attendance-summary"
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                json={"month": month.isoformat(), "summaries": report_data},
                headers=headers,
            )
            logger.info(f"Pushed payroll attendance summary to HR Core: status={resp.status_code}")
    except Exception as e:
        logger.warning(f"Failed to push payroll summary to HR Core: {e}")

    return {
        "status": "ok",
        "message": f"Đã chốt công tháng {month.strftime('%m/%Y')} thành công",
        "finalized_count": len(summaries),
    }

