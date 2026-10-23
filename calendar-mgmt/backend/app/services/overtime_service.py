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


async def sync_overtime_to_schedule(
    db: AsyncSession,
    reg,
    approver_id: UUID = None,
    auth_token: str = "",
) -> Optional[Schedule]:
    """
    Tự động cập nhật / tạo lịch trực khi đơn đăng ký thêm giờ được duyệt thành công.
    """
    from datetime import datetime, timezone
    from app.models.shift_template import ShiftTemplate
    from app.models.schedule_change_log import ScheduleChangeLog
    from app.core.constants import ChangeType
    from app.clients.hr_client import hr_client
    from app.services.shift_utils import calculate_shift_hours

    # 1. Kiểm tra xem nhân viên đã có lịch trực trong ngày chưa
    existing_res = await db.execute(
        select(Schedule).where(
            Schedule.employee_id == reg.employee_id,
            Schedule.date == reg.date,
        )
    )
    existing_schedules = existing_res.scalars().all()

    from datetime import time

    # Helper to check if registration covers morning and afternoon
    spans_lunch = reg.start_time and reg.end_time and reg.start_time < time(12, 0) and reg.end_time > time(13, 0)

    # Nếu có lịch đang hoạt động (không bị huỷ)
    active_schedules = [s for s in existing_schedules if s.status != ScheduleStatus.CANCELLED]
    if active_schedules:
        sched = active_schedules[0]
        st = await db.get(ShiftTemplate, sched.shift_template_id)
        sched.is_overtime = True
        sched.is_overtime_approved = True

        # Giữ giờ bắt đầu và kết thúc của ca, không để ca sáng kéo dài sang ca chiều
        if reg.start_time and not sched.actual_start_time:
            sched.actual_start_time = reg.start_time
        if reg.end_time and not sched.actual_end_time:
            if st and st.end_time and st.end_time <= time(12, 30):
                sched.actual_end_time = min(reg.end_time, st.end_time)
            else:
                sched.actual_end_time = reg.end_time

        ot_note = f"Tăng ca: {reg.reason}" if reg.reason else "Tăng ca (Đã duyệt)"
        sched.notes = f"{sched.notes}; {ot_note}" if sched.notes else ot_note
        if approver_id:
            sched.approved_by_id = approver_id
        sched.approved_at = datetime.now(timezone.utc)

        log = ScheduleChangeLog(
            schedule_id=sched.id,
            changed_by_id=approver_id,
            change_type=ChangeType.UPDATE,
            new_values={
                "is_overtime": True,
                "is_overtime_approved": True,
                "total_hours": sched.total_hours,
                "source": "overtime_registration_approved",
            },
            reason="Tự động cập nhật từ đơn đăng ký thêm giờ đã duyệt",
        )
        db.add(log)

        # Nếu đơn tăng ca bao gồm cả ca chiều nhưng chưa có ca chiều, tạo thêm ca chiều
        if spans_lunch:
            afternoon_sched = next((s for s in existing_schedules if s.shift_template_id != sched.shift_template_id and s.status != ScheduleStatus.CANCELLED), None)
            if not afternoon_sched:
                st_res = await db.execute(select(ShiftTemplate).where(ShiftTemplate.is_active == True, ShiftTemplate.start_time >= time(12, 30)))
                afternoon_st = st_res.scalars().first()
                if afternoon_st:
                    import uuid
                    new_afternoon = Schedule(
                        id=uuid.uuid4(),
                        employee_id=reg.employee_id,
                        shift_template_id=afternoon_st.id,
                        workplace_id=afternoon_st.workplace_id,
                        date=reg.date,
                        status=ScheduleStatus.APPROVED,
                        actual_start_time=time(13, 0),
                        actual_end_time=reg.end_time,
                        total_hours=calculate_shift_hours(time(13, 0), reg.end_time),
                        is_overtime=True,
                        is_overtime_approved=True,
                        notes=f"Tăng ca chiều: {reg.reason or ''}".strip(),
                        created_by_id=approver_id,
                        approved_by_id=approver_id,
                        approved_at=datetime.now(timezone.utc),
                    )
                    db.add(new_afternoon)
        return sched

    # Nếu có lịch nhưng đang bị CANCELLED -> kích hoạt lại thành APPROVED
    cancelled_schedules = [s for s in existing_schedules if s.status == ScheduleStatus.CANCELLED]
    if cancelled_schedules:
        sched = cancelled_schedules[0]
        st = await db.get(ShiftTemplate, sched.shift_template_id)
        sched.status = ScheduleStatus.APPROVED
        sched.is_overtime = True
        sched.is_overtime_approved = True

        sched.actual_start_time = reg.start_time
        if st and st.end_time and st.end_time <= time(12, 30):
            sched.actual_end_time = min(reg.end_time, st.end_time) if reg.end_time else st.end_time
        else:
            sched.actual_end_time = reg.end_time

        sched.notes = f"Tăng ca: {reg.reason}" if reg.reason else (sched.notes or "Tăng ca (Đã duyệt)")
        if approver_id:
            sched.approved_by_id = approver_id
        sched.approved_at = datetime.now(timezone.utc)

        log = ScheduleChangeLog(
            schedule_id=sched.id,
            changed_by_id=approver_id,
            change_type=ChangeType.RESTORE,
            new_values={
                "status": ScheduleStatus.APPROVED.value,
                "is_overtime": True,
                "is_overtime_approved": True,
                "source": "overtime_registration_approved",
            },
            reason="Tự động kích hoạt lịch trực từ đơn đăng ký thêm giờ đã duyệt",
        )
        db.add(log)

        if spans_lunch:
            st_res = await db.execute(select(ShiftTemplate).where(ShiftTemplate.is_active == True, ShiftTemplate.start_time >= time(12, 30)))
            afternoon_st = st_res.scalars().first()
            if afternoon_st:
                import uuid
                new_afternoon = Schedule(
                    id=uuid.uuid4(),
                    employee_id=reg.employee_id,
                    shift_template_id=afternoon_st.id,
                    workplace_id=afternoon_st.workplace_id,
                    date=reg.date,
                    status=ScheduleStatus.APPROVED,
                    actual_start_time=time(13, 0),
                    actual_end_time=reg.end_time,
                    total_hours=calculate_shift_hours(time(13, 0), reg.end_time),
                    is_overtime=True,
                    is_overtime_approved=True,
                    notes=f"Tăng ca chiều: {reg.reason or ''}".strip(),
                    created_by_id=approver_id,
                    approved_by_id=approver_id,
                    approved_at=datetime.now(timezone.utc),
                )
                db.add(new_afternoon)
        return sched

    # 2. Nếu chưa có lịch trực nào trong ngày -> tìm ShiftTemplate và Workplace phù hợp để tạo mới
    emp = await hr_client.get_employee(str(reg.employee_id), token=auth_token)
    emp_dept_id = str(emp.get("department_id")) if emp and emp.get("department_id") else None
    emp_wp_id = str(emp.get("workplace_id")) if emp and emp.get("workplace_id") else None

    st_res = await db.execute(select(ShiftTemplate).where(ShiftTemplate.is_active == True))
    all_shifts = st_res.scalars().all()
    if not all_shifts:
        return None

    # Tìm ca trực ứng với phòng ban
    dept_shifts = [
        st for st in all_shifts
        if emp_dept_id and st.department_ids and emp_dept_id in [str(d) for d in st.department_ids]
    ]

    candidates = dept_shifts if dept_shifts else all_shifts
    if emp_wp_id:
        wp_candidates = [st for st in candidates if str(st.workplace_id) == emp_wp_id]
        if wp_candidates:
            candidates = wp_candidates

    # Chọn ca trực gần với giờ bắt đầu nhất
    selected_shift = candidates[0]
    if reg.start_time and len(candidates) > 1:
        reg_min = reg.start_time.hour * 60 + reg.start_time.minute
        candidates.sort(
            key=lambda st: abs((st.start_time.hour * 60 + st.start_time.minute) - reg_min)
        )
        selected_shift = candidates[0]

    hours = reg.total_hours or calculate_shift_hours(selected_shift.start_time, selected_shift.end_time)

    import uuid

    new_sched = Schedule(
        id=uuid.uuid4(),
        employee_id=reg.employee_id,
        shift_template_id=selected_shift.id,
        workplace_id=selected_shift.workplace_id,
        date=reg.date,
        status=ScheduleStatus.APPROVED,
        actual_start_time=reg.start_time,
        actual_end_time=reg.end_time,
        total_hours=hours,
        is_overtime=True,
        is_overtime_approved=True,
        notes=f"Tăng ca: {reg.reason}" if reg.reason else "Tăng ca (Đã duyệt)",
        created_by_id=approver_id,
        approved_by_id=approver_id,
        approved_at=datetime.now(timezone.utc),
    )
    db.add(new_sched)

    log = ScheduleChangeLog(
        schedule_id=new_sched.id,
        changed_by_id=approver_id,
        change_type=ChangeType.CREATE,
        new_values={
            "employee_id": str(reg.employee_id),
            "shift_template_id": str(selected_shift.id),
            "workplace_id": str(selected_shift.workplace_id),
            "date": reg.date.isoformat(),
            "status": ScheduleStatus.APPROVED.value,
            "is_overtime": True,
            "total_hours": hours,
            "source": "overtime_registration_approved",
        },
        reason="Tự động tạo lịch trực từ đơn đăng ký thêm giờ đã duyệt",
    )
    db.add(log)
    return new_sched


async def revert_overtime_schedule(db: AsyncSession, reg) -> None:
    """
    Khi xoá / huỷ đơn đăng ký thêm giờ, huỷ lịch tăng ca tương ứng.
    """
    res = await db.execute(
        select(Schedule).where(
            Schedule.employee_id == reg.employee_id,
            Schedule.date == reg.date,
            Schedule.is_overtime == True,
            Schedule.status != ScheduleStatus.CANCELLED,
        )
    )
    schedules = res.scalars().all()
    for s in schedules:
        if s.notes and "Tăng ca" in s.notes:
            s.status = ScheduleStatus.CANCELLED
            s.is_overtime = False
            s.is_overtime_approved = False

