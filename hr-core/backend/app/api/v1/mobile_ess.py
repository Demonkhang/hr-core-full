from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError, BadRequestError
from app.database import get_db, engine
from app.models.base import Base
from app.models.user import User
from app.models.employee import Employee
from app.models.department import Department
from app.models.position import Position
from app.models.contract import Contract
from app.models.personnel_profile import VcProfile
from app.models.personnel_alert import VcPersonnelAlert
from app.models.mobile_ess import (
    MobileEssSchedule,
    MobileEssLeaveRequest,
    MobileEssOvertimeRequest,
)
from app.schemas.mobile_ess import (
    MobileScheduleCreate,
    MobileScheduleItem,
    MobileLeaveRequestCreate,
    MobileLeaveRequestItem,
    MobileOvertimeCreate,
    MobileOvertimeItem,
    MobileContractBrief,
    MobilePersonalAlertBrief,
    MobileSpecialistSummaryResponse,
)

router = APIRouter()
_MOBILE_TABLES_INITIALIZED = False


async def _ensure_mobile_ess_tables() -> None:
    """Khởi tạo 3 bảng độc lập của Core Mobile (Không tác động bất kỳ bảng nào của Core Website)"""
    global _MOBILE_TABLES_INITIALIZED
    if _MOBILE_TABLES_INITIALIZED:
        return
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(
                sync_conn,
                tables=[
                    MobileEssSchedule.__table__,
                    MobileEssLeaveRequest.__table__,
                    MobileEssOvertimeRequest.__table__,
                ],
                checkfirst=True,
            )
        )
    _MOBILE_TABLES_INITIALIZED = True


async def _resolve_current_specialist_context(
    db: AsyncSession, current_user: User
) -> Tuple[Optional[Employee], Optional[VcProfile], Optional[str], Optional[str]]:
    """
    Chỉ ĐỌC (SELECT Read-Only) thông tin cá nhân của chính tài khoản đang đăng nhập (`current_user`).
    Tuyệt đối không chỉnh sửa dữ liệu Core Website.
    """
    emp: Optional[Employee] = None
    vc_prof: Optional[VcProfile] = None
    dept_name: Optional[str] = None
    pos_name: Optional[str] = None

    if current_user.employee_id:
        res_emp = await db.execute(
            select(Employee).where(Employee.id == current_user.employee_id)
        )
        emp = res_emp.scalar_one_or_none()

    res_prof = await db.execute(
        select(VcProfile).where(VcProfile.user_id == current_user.id)
    )
    vc_prof = res_prof.scalar_one_or_none()

    if not vc_prof and emp:
        res_prof_emp = await db.execute(
            select(VcProfile).where(VcProfile.employee_id == emp.id)
        )
        vc_prof = res_prof_emp.scalar_one_or_none()

    if not emp and vc_prof and vc_prof.employee_id:
        res_emp2 = await db.execute(
            select(Employee).where(Employee.id == vc_prof.employee_id)
        )
        emp = res_emp2.scalar_one_or_none()

    dept_id = (emp.department_id if emp else None) or current_user.department_id
    if dept_id:
        res_dept = await db.execute(
            select(Department.name).where(Department.id == dept_id)
        )
        dept_name = res_dept.scalar_one_or_none()

    pos_id = emp.position_id if emp else None
    if pos_id:
        res_pos = await db.execute(
            select(Position.name).where(Position.id == pos_id)
        )
        pos_name = res_pos.scalar_one_or_none()

    if not dept_name and vc_prof:
        dept_name = vc_prof.using_agency_name or vc_prof.work_unit_name
    if not pos_name:
        if emp and emp.position:
            pos_name = emp.position
        elif vc_prof:
            pos_name = vc_prof.leadership_position or vc_prof.approved_job_position_name

    return emp, vc_prof, dept_name, pos_name


def _calculate_hours_between(start_time: str, end_time: str) -> float:
    try:
        sh, sm = [int(x) for x in start_time.strip().split(":")[:2]]
        eh, em = [int(x) for x in end_time.strip().split(":")[:2]]
        diff = (eh * 60 + em) - (sh * 60 + sm)
        if diff <= 0:
            return 2.0
        return round(diff / 60.0, 1)
    except Exception:
        return 2.5


@router.get("/me", response_model=MobileSpecialistSummaryResponse)
async def get_mobile_specialist_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    API Tổng hợp Cổng Mobile Chuyên viên (Self-Service):
    - Chỉ trả về dữ liệu của chính người dùng đang đăng nhập (`current_user.id`).
    - Thực hiện Read-Only trên hồ sơ nhân sự / hợp đồng / cảnh báo đến hạn cá nhân.
    - Đọc dữ liệu Lịch cá nhân, Nghỉ phép, Làm thêm giờ (OT) từ 3 bảng độc lập `mobile_ess_*`.
    """
    await _ensure_mobile_ess_tables()

    emp, vc_prof, dept_name, pos_name = await _resolve_current_specialist_context(
        db, current_user
    )

    today = date.today()
    emp_id = emp.id if emp else (vc_prof.employee_id if vc_prof else None)

    # 1. Đọc danh sách lịch làm việc / lịch công tác cá nhân từ bảng mobile_ess_schedules
    res_sched = await db.execute(
        select(MobileEssSchedule)
        .where(MobileEssSchedule.user_id == current_user.id)
        .order_by(MobileEssSchedule.schedule_date.desc(), MobileEssSchedule.start_time.asc())
    )
    sched_rows = res_sched.scalars().all()
    schedules = [
        MobileScheduleItem(
            id=str(r.id),
            schedule_date=r.schedule_date,
            start_time=r.start_time,
            end_time=r.end_time,
            schedule_type=r.schedule_type,
            title=r.title,
            location=r.location,
            notes=r.notes,
            status=r.status,
            created_at=r.created_at,
        )
        for r in sched_rows
    ]

    # 2. Đọc danh sách đơn xin nghỉ phép cá nhân từ bảng mobile_ess_leave_requests
    res_leave = await db.execute(
        select(MobileEssLeaveRequest)
        .where(MobileEssLeaveRequest.user_id == current_user.id)
        .order_by(MobileEssLeaveRequest.start_date.desc(), MobileEssLeaveRequest.created_at.desc())
    )
    leave_rows = res_leave.scalars().all()
    leave_requests = [
        MobileLeaveRequestItem(
            id=str(r.id),
            leave_type=r.leave_type,
            start_date=r.start_date,
            end_date=r.end_date,
            session_type=r.session_type,
            total_days=float(r.total_days or 0),
            reason=r.reason,
            handover_person=r.handover_person,
            contact_phone=r.contact_phone,
            status=r.status,
            reviewer_note=r.reviewer_note,
            created_at=r.created_at,
        )
        for r in leave_rows
    ]

    # Tính quỹ phép năm thực tế từ các đơn ANNUAL_LEAVE trong năm hiện tại (không bị REJECTED / CANCELLED)
    annual_total = 12.0
    annual_used = 0.0
    pending_leave_count = 0
    for r in leave_rows:
        if r.status == "PENDING":
            pending_leave_count += 1
        if (
            r.leave_type == "ANNUAL_LEAVE"
            and r.status in ("APPROVED", "PENDING")
            and r.start_date.year == today.year
        ):
            annual_used += float(r.total_days or 0)
    annual_remaining = max(0.0, round(annual_total - annual_used, 1))

    # 3. Đọc danh sách đăng ký làm thêm giờ (OT) cá nhân từ bảng mobile_ess_overtime_requests
    res_ot = await db.execute(
        select(MobileEssOvertimeRequest)
        .where(MobileEssOvertimeRequest.user_id == current_user.id)
        .order_by(MobileEssOvertimeRequest.work_date.desc(), MobileEssOvertimeRequest.created_at.desc())
    )
    ot_rows = res_ot.scalars().all()
    overtime_requests = [
        MobileOvertimeItem(
            id=str(r.id),
            work_date=r.work_date,
            start_time=r.start_time,
            end_time=r.end_time,
            total_hours=float(r.total_hours or 0),
            day_type=r.day_type,
            work_location=r.work_location,
            task_description=r.task_description,
            status=r.status,
            reviewer_note=r.reviewer_note,
            created_at=r.created_at,
        )
        for r in ot_rows
    ]

    current_month_ot_hours = 0.0
    pending_ot_count = 0
    for r in ot_rows:
        if r.status == "PENDING":
            pending_ot_count += 1
        if (
            r.status in ("APPROVED", "PENDING")
            and r.work_date.year == today.year
            and r.work_date.month == today.month
        ):
            current_month_ot_hours += float(r.total_hours or 0)

    # 4. Đọc (Read-Only) Hợp đồng làm việc của cá nhân từ bảng contracts (nếu có employee_id)
    contracts: list[MobileContractBrief] = []
    if emp_id:
        res_contracts = await db.execute(
            select(Contract)
            .where(Contract.employee_id == emp_id)
            .order_by(Contract.start_date.desc())
        )
        for c in res_contracts.scalars().all():
            contracts.append(
                MobileContractBrief(
                    id=str(c.id),
                    contract_number=c.contract_number,
                    contract_type=c.contract_type,
                    start_date=c.start_date,
                    end_date=c.end_date,
                    status=c.status,
                    job_title=c.job_title,
                )
            )

    # 5. Đọc (Read-Only) Cảnh báo nâng lương / bổ nhiệm lại của cá nhân từ vc_personnel_alerts
    personal_alerts: list[MobilePersonalAlertBrief] = []
    if vc_prof:
        res_alerts = await db.execute(
            select(VcPersonnelAlert)
            .where(VcPersonnelAlert.profile_id == vc_prof.id)
            .order_by(VcPersonnelAlert.due_date.asc())
        )
        for a in res_alerts.scalars().all():
            days_rem = (a.due_date - today).days if a.due_date else 0
            personal_alerts.append(
                MobilePersonalAlertBrief(
                    id=str(a.id),
                    alert_category=a.alert_category,
                    due_date=a.due_date,
                    days_remaining=days_rem,
                    workflow_status=a.workflow_status,
                    current_step=a.current_step,
                    proposed_step=a.proposed_step,
                    current_coefficient=float(a.current_coefficient) if a.current_coefficient is not None else None,
                    proposed_coefficient=float(a.proposed_coefficient) if a.proposed_coefficient is not None else None,
                    leadership_position=a.leadership_position,
                )
            )

    # 6. Tổng hợp thông tin định danh & lương thực tế của Chuyên viên
    full_name = (
        (vc_prof.birth_full_name if vc_prof and vc_prof.birth_full_name else None)
        or (emp.full_name if emp else None)
        or current_user.full_name
        or current_user.username
    )
    coeff = (
        float(vc_prof.salary_coefficient)
        if vc_prof and vc_prof.salary_coefficient is not None
        else None
    )
    base_salary_vn = 2340000.0  # Mức lương cơ sở hiện hành (NĐ 73/2024/NĐ-CP)
    estimated_salary = round(coeff * base_salary_vn, 0) if coeff else 0.0

    is_official_vc = bool(
        (
            vc_prof
            and (
                vc_prof.professional_title_code
                or vc_prof.official_file_code
                or vc_prof.first_recruitment_date
                or vc_prof.current_agency_join_date
            )
        )
        or any(c.contract_type in ("definite_term", "indefinite_term") for c in contracts)
    )
    is_cpv = bool(
        vc_prof
        and (
            vc_prof.cpv_probationary_date
            or vc_prof.cpv_official_date
            or vc_prof.cpv_card_number
        )
    )

    completion_fields = [
        "cccd_number",
        "official_file_code",
        "social_insurance_code",
        "birth_full_name",
        "date_of_birth",
        "gender",
        "birthplace_province",
        "hometown_province",
        "permanent_address",
        "current_address",
        "ethnicity",
        "religion",
        "personal_phone",
        "health_classification",
        "general_education_level",
        "highest_professional_degree",
        "political_theory_level",
        "state_management_level",
        "first_recruitment_date",
        "work_unit_name",
        "professional_title_name",
        "professional_title_code",
        "salary_step",
        "salary_coefficient",
    ]
    if vc_prof:
        filled_cnt = sum(
            1
            for f in completion_fields
            if getattr(vc_prof, f, None) is not None and str(getattr(vc_prof, f, None)).strip() != ""
        )
        completion_pct = min(100, round((filled_cnt / len(completion_fields)) * 100))
    else:
        completion_pct = 0

    return MobileSpecialistSummaryResponse(
        user_id=str(current_user.id),
        employee_id=str(emp_id) if emp_id else None,
        username=current_user.username,
        full_name=full_name,
        birth_full_name=(vc_prof.birth_full_name if vc_prof and vc_prof.birth_full_name else full_name),
        official_file_code=(vc_prof.official_file_code if vc_prof and vc_prof.official_file_code else (emp.employee_code if emp else None)),
        cccd_number=(vc_prof.cccd_number if vc_prof else None),
        social_insurance_code=(vc_prof.social_insurance_code if vc_prof else None),
        health_insurance_card_no=(vc_prof.health_insurance_card_no if vc_prof else None),
        gender=(vc_prof.gender if vc_prof else None),
        date_of_birth=(vc_prof.date_of_birth if vc_prof else None),
        personal_phone=(vc_prof.personal_phone if vc_prof and vc_prof.personal_phone else (emp.phone if emp else None)),
        email=(vc_prof.personal_email if vc_prof and vc_prof.personal_email else (emp.email if emp and emp.email else current_user.email)),
        portrait_url=(vc_prof.portrait_url if vc_prof else None),
        department_name=dept_name or "Văn phòng",
        position_name=pos_name or "Chuyên viên",
        professional_title_name=(vc_prof.professional_title_name if vc_prof and vc_prof.professional_title_name else "Chuyên viên (Hạng III)"),
        professional_title_code=(vc_prof.professional_title_code if vc_prof and vc_prof.professional_title_code else "01.003"),
        is_official_civil_servant=is_official_vc,
        is_cpv_member=is_cpv,
        cpv_official_date=(vc_prof.cpv_official_date if vc_prof else None),
        highest_professional_degree=(vc_prof.highest_professional_degree if vc_prof else None),
        salary_step=(vc_prof.salary_step if vc_prof else None),
        salary_coefficient=coeff,
        salary_effective_date=(vc_prof.salary_effective_date if vc_prof else None),
        next_promotion_date=(vc_prof.next_promotion_date if vc_prof else None),
        estimated_monthly_salary=estimated_salary,
        profile_completion_percent=completion_pct,
        annual_leave_total_days=annual_total,
        annual_leave_used_days=round(annual_used, 1),
        annual_leave_remaining_days=annual_remaining,
        pending_leave_count=pending_leave_count,
        current_month_ot_hours=round(current_month_ot_hours, 1),
        pending_ot_count=pending_ot_count,
        schedules=schedules,
        leave_requests=leave_requests,
        overtime_requests=overtime_requests,
        contracts=contracts,
        personal_alerts=personal_alerts,
    )


@router.post("/schedules", response_model=MobileScheduleItem)
async def create_personal_schedule(
    payload: MobileScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo lịch công tác / lịch làm việc cá nhân trên Core Mobile (Lưu vào mobile_ess_schedules)"""
    await _ensure_mobile_ess_tables()
    if not payload.title or not payload.title.strip():
        raise BadRequestError("Vui lòng nhập tiêu đề lịch công tác / làm việc")

    item = MobileEssSchedule(
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        schedule_date=payload.schedule_date,
        start_time=payload.start_time or "07:30",
        end_time=payload.end_time or "17:00",
        schedule_type=payload.schedule_type or "OFFICE_WORK",
        title=payload.title.strip(),
        location=payload.location.strip() if payload.location else None,
        notes=payload.notes.strip() if payload.notes else None,
        status="CONFIRMED",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return MobileScheduleItem(
        id=str(item.id),
        schedule_date=item.schedule_date,
        start_time=item.start_time,
        end_time=item.end_time,
        schedule_type=item.schedule_type,
        title=item.title,
        location=item.location,
        notes=item.notes,
        status=item.status,
        created_at=item.created_at,
    )


@router.delete("/schedules/{schedule_id}")
async def delete_personal_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Xóa lịch cá nhân của chính người dùng đang đăng nhập"""
    await _ensure_mobile_ess_tables()
    res = await db.execute(
        select(MobileEssSchedule).where(
            MobileEssSchedule.id == schedule_id,
            MobileEssSchedule.user_id == current_user.id,
        )
    )
    item = res.scalar_one_or_none()
    if not item:
        raise NotFoundError("Không tìm thấy lịch cá nhân này")
    await db.delete(item)
    await db.commit()
    return {"message": "Đã xóa lịch cá nhân thành công"}


@router.post("/leave-requests", response_model=MobileLeaveRequestItem)
async def create_personal_leave_request(
    payload: MobileLeaveRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tạo đơn xin nghỉ phép cá nhân trên Core Mobile (Lưu vào mobile_ess_leave_requests)"""
    await _ensure_mobile_ess_tables()
    if payload.end_date < payload.start_date:
        raise BadRequestError("Ngày kết thúc nghỉ phép không được nhỏ hơn ngày bắt đầu")
    if not payload.reason or not payload.reason.strip():
        raise BadRequestError("Vui lòng nhập lý do xin nghỉ phép")

    if payload.total_days is not None and float(payload.total_days) > 0:
        calc_days = float(payload.total_days)
    else:
        raw_days = (payload.end_date - payload.start_date).days + 1
        if payload.session_type in ("MORNING", "AFTERNOON") and raw_days == 1:
            calc_days = 0.5
        else:
            calc_days = float(raw_days)

    item = MobileEssLeaveRequest(
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        leave_type=payload.leave_type or "ANNUAL_LEAVE",
        start_date=payload.start_date,
        end_date=payload.end_date,
        session_type=payload.session_type or "FULL_DAY",
        total_days=Decimal(str(round(calc_days, 1))),
        reason=payload.reason.strip(),
        handover_person=payload.handover_person.strip() if payload.handover_person else None,
        contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
        status="PENDING",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return MobileLeaveRequestItem(
        id=str(item.id),
        leave_type=item.leave_type,
        start_date=item.start_date,
        end_date=item.end_date,
        session_type=item.session_type,
        total_days=float(item.total_days),
        reason=item.reason,
        handover_person=item.handover_person,
        contact_phone=item.contact_phone,
        status=item.status,
        reviewer_note=item.reviewer_note,
        created_at=item.created_at,
    )


@router.delete("/leave-requests/{request_id}")
async def cancel_personal_leave_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hủy / thu hồi đơn xin nghỉ phép đang chờ duyệt của chính chuyên viên"""
    await _ensure_mobile_ess_tables()
    res = await db.execute(
        select(MobileEssLeaveRequest).where(
            MobileEssLeaveRequest.id == request_id,
            MobileEssLeaveRequest.user_id == current_user.id,
        )
    )
    item = res.scalar_one_or_none()
    if not item:
        raise NotFoundError("Không tìm thấy đơn xin nghỉ phép này")
    await db.delete(item)
    await db.commit()
    return {"message": "Đã thu hồi đơn xin nghỉ phép thành công"}


@router.post("/overtime-requests", response_model=MobileOvertimeItem)
async def create_personal_overtime_request(
    payload: MobileOvertimeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Đăng ký làm thêm giờ (OT) cá nhân trên Core Mobile (Lưu vào mobile_ess_overtime_requests)"""
    await _ensure_mobile_ess_tables()
    if not payload.task_description or not payload.task_description.strip():
        raise BadRequestError("Vui lòng nhập nội dung công việc giải quyết khi làm thêm giờ")

    if payload.total_hours is not None and float(payload.total_hours) > 0:
        calc_hours = float(payload.total_hours)
    else:
        calc_hours = _calculate_hours_between(payload.start_time, payload.end_time)

    item = MobileEssOvertimeRequest(
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        work_date=payload.work_date,
        start_time=payload.start_time or "17:30",
        end_time=payload.end_time or "20:30",
        total_hours=Decimal(str(round(calc_hours, 1))),
        day_type=payload.day_type or "WEEKDAY_150",
        work_location=payload.work_location.strip() if payload.work_location else "Tại cơ quan",
        task_description=payload.task_description.strip(),
        status="PENDING",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return MobileOvertimeItem(
        id=str(item.id),
        work_date=item.work_date,
        start_time=item.start_time,
        end_time=item.end_time,
        total_hours=float(item.total_hours),
        day_type=item.day_type,
        work_location=item.work_location,
        task_description=item.task_description,
        status=item.status,
        reviewer_note=item.reviewer_note,
        created_at=item.created_at,
    )


@router.delete("/overtime-requests/{request_id}")
async def cancel_personal_overtime_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hủy / thu hồi phiếu đăng ký làm thêm giờ (OT) của chính chuyên viên"""
    await _ensure_mobile_ess_tables()
    res = await db.execute(
        select(MobileEssOvertimeRequest).where(
            MobileEssOvertimeRequest.id == request_id,
            MobileEssOvertimeRequest.user_id == current_user.id,
        )
    )
    item = res.scalar_one_or_none()
    if not item:
        raise NotFoundError("Không tìm thấy phiếu đăng ký OT này")
    await db.delete(item)
    await db.commit()
    return {"message": "Đã thu hồi phiếu đăng ký làm thêm giờ thành công"}

