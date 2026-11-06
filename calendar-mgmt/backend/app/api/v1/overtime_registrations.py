import logging
from typing import Optional, List
from datetime import datetime, timezone, date, time
from fastapi import APIRouter, Depends, Query, Request, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission
from app.api.v1.helpers import build_overtime_registration_response
from app.schemas.overtime_registration import OvertimeRegistrationCreate, OvertimeRegistrationUpdate, OvertimeRegistrationResponse, OvertimeRegistrationAction
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.models.overtime_registration import OvertimeRegistration, OvertimeRegistrationStatus
from app.clients.hr_client import hr_client
from app.services.overtime_service import sync_overtime_to_schedule, revert_overtime_schedule
from app.services.leave_service import LeaveService
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

router = APIRouter()

OT_DAILY_LIMIT = 12.0
OT_MONTHLY_LIMIT = 40.0
OT_YEARLY_LIMIT = 200.0


async def _get_employee_ot_hours(
    db: AsyncSession,
    employee_id: str,
    target_date: date,
    exclude_reg_id: str | None = None,
) -> dict[str, float]:
    year_start = date(target_date.year, 1, 1)
    year_end = date(target_date.year, 12, 31)
    month_start = date(target_date.year, target_date.month, 1)
    next_month = date(
        target_date.year + (target_date.month // 12),
        (target_date.month % 12) + 1,
        1,
    )

    query = select(OvertimeRegistration).where(
        OvertimeRegistration.employee_id == employee_id,
        OvertimeRegistration.is_active == True,
        OvertimeRegistration.date >= year_start,
        OvertimeRegistration.date <= year_end,
        OvertimeRegistration.status.in_([
            OvertimeRegistrationStatus.APPROVED,
            OvertimeRegistrationStatus.PENDING,
        ]),
    )
    if exclude_reg_id:
        query = query.where(OvertimeRegistration.id != exclude_reg_id)

    res = await db.execute(query)
    regs = res.scalars().all()

    month_approved = 0.0
    month_pending = 0.0
    year_approved = 0.0
    year_pending = 0.0

    for r in regs:
        hrs = float(r.total_hours or 0.0)
        is_in_month = month_start <= r.date < next_month
        if r.status == OvertimeRegistrationStatus.APPROVED:
            year_approved += hrs
            if is_in_month:
                month_approved += hrs
        elif r.status == OvertimeRegistrationStatus.PENDING:
            year_pending += hrs
            if is_in_month:
                month_pending += hrs

    return {
        "month_approved": round(month_approved, 1),
        "month_pending": round(month_pending, 1),
        "year_approved": round(year_approved, 1),
        "year_pending": round(year_pending, 1),
    }


async def _validate_ot_limits(
    db: AsyncSession,
    employee_id: str,
    reg_date: date,
    total_hours: float,
    exclude_reg_id: str | None = None,
) -> None:
    if total_hours <= 0:
        raise BadRequestError(detail="Số giờ làm thêm phải lớn hơn 0")
    if total_hours > OT_DAILY_LIMIT:
        raise BadRequestError(
            detail=f"Theo Điều 107 Bộ luật Lao động 2019, tổng thời gian làm việc không vượt quá {OT_DAILY_LIMIT:.0f} giờ/ngày (Yêu cầu: {total_hours:.1f}h)"
        )
    ot_stats = await _get_employee_ot_hours(db, str(employee_id), reg_date, exclude_reg_id=exclude_reg_id)
    if ot_stats["month_approved"] + total_hours > OT_MONTHLY_LIMIT:
        raise BadRequestError(
            detail=f"Vượt trần làm thêm giờ trong tháng theo Điều 107 BLLĐ (Tối đa {OT_MONTHLY_LIMIT:.0f}h/tháng, Đã duyệt tháng {reg_date.strftime('%m/%Y')}: {ot_stats['month_approved']:.1f}h, Yêu cầu thêm: {total_hours:.1f}h)"
        )
    if ot_stats["year_approved"] + total_hours > OT_YEARLY_LIMIT:
        raise BadRequestError(
            detail=f"Vượt trần làm thêm giờ trong năm theo Điều 107 BLLĐ (Tối đa {OT_YEARLY_LIMIT:.0f}h/năm, Đã duyệt năm {reg_date.year}: {ot_stats['year_approved']:.1f}h, Yêu cầu thêm: {total_hours:.1f}h)"
        )


class BulkApproveRequest(BaseModel):
    registration_ids: list[str]


class BulkRejectRequest(BaseModel):
    registration_ids: list[str]
    reason: str


async def find_official_schedule_overlap(
    db: AsyncSession,
    employee_id: str,
    reg_date: date,
    start_time: Optional[time],
    end_time: Optional[time],
) -> Optional[dict]:
    """Kiểm tra xem khung giờ đăng ký làm thêm có bị trùng với ca làm việc chính thức nào không."""
    if not start_time or not end_time:
        return None
    from app.models.schedule import Schedule
    from app.models.shift_template import ShiftTemplate
    from app.core.constants import ScheduleStatus
    
    res = await db.execute(
        select(Schedule).where(
            Schedule.employee_id == employee_id,
            Schedule.date == reg_date,
            Schedule.status != ScheduleStatus.CANCELLED,
            Schedule.is_overtime == False,
        )
    )
    schedules = res.scalars().all()
    for s in schedules:
        st = await db.get(ShiftTemplate, s.shift_template_id)
        s_start = s.actual_start_time or (st.start_time if st else None)
        s_end = s.actual_end_time or (st.end_time if st else None)
        if s_start and s_end:
            # Điều kiện trùng khoảng thời gian: start_time < s_end and end_time > s_start
            if start_time < s_end and end_time > s_start:
                shift_name = st.name if st else "Ca làm việc chính thức"
                return {
                    "schedule_id": str(s.id),
                    "shift_name": shift_name,
                    "start_time": s_start.strftime("%H:%M"),
                    "end_time": s_end.strftime("%H:%M"),
                    "message": f"Khung giờ làm thêm trùng với lịch làm việc chính thức: {shift_name} ({s_start.strftime('%H:%M')} - {s_end.strftime('%H:%M')})"
                }
    return None


@router.get("/check-conflict")
async def check_overtime_conflict(
    employee_id: str = Query(...),
    date: date = Query(...),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """API kiểm tra xem khung giờ làm thêm có bị trùng với lịch trực chính thức không."""
    st = None
    et = None
    if start_time:
        try:
            parts = start_time.split(":")
            st = time(int(parts[0]), int(parts[1]))
        except Exception:
            pass
    if end_time:
        try:
            parts = end_time.split(":")
            et = time(int(parts[0]), int(parts[1]))
        except Exception:
            pass

    conflict = await find_official_schedule_overlap(db, employee_id, date, st, et)
    return {"has_conflict": conflict is not None, "conflict": conflict}


@router.get("", response_model=list[OvertimeRegistrationResponse])
async def list_overtime_registrations(
    employee_id: Optional[str] = Query(None),
    department_id: Optional[List[str]] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if date_from and date_to and date_from > date_to:
        raise BadRequestError(detail="date_from phải trước hoặc bằng date_to")
    query = select(OvertimeRegistration)
    if active_only:
        query = query.where(OvertimeRegistration.is_active == True)
    if employee_id:
        query = query.where(OvertimeRegistration.employee_id == employee_id)
    if status:
        query = query.where(OvertimeRegistration.status == status)
    if date_from:
        query = query.where(OvertimeRegistration.date >= date_from)
    if date_to:
        query = query.where(OvertimeRegistration.date <= date_to)
    query = query.order_by(OvertimeRegistration.date.desc(), OvertimeRegistration.created_at.desc())

    result = await db.execute(query)
    registrations = result.scalars().all()

    emp_ids = list(set(str(r.employee_id) for r in registrations))
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    return [build_overtime_registration_response(r, emp=emp_map.get(str(r.employee_id))) for r in registrations]


@router.get("/statistics")
async def get_overtime_statistics(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None, ge=1, le=12),
    employee_id: Optional[str] = Query(None),
    department_id: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    today = date.today()
    target_year = year or today.year
    target_month = month or today.month
    token = current_user.get("_token", "")

    year_start = date(target_year, 1, 1)
    year_end = date(target_year, 12, 31)
    month_start = date(target_year, target_month, 1)
    next_month = date(
        target_year + (target_month // 12),
        (target_month % 12) + 1,
        1,
    )

    employees = await hr_client.get_employees(active_only=True, token=token)
    emp_map = {str(e["id"]): e for e in employees}

    query = select(OvertimeRegistration).where(
        OvertimeRegistration.is_active == True,
        OvertimeRegistration.date >= year_start,
        OvertimeRegistration.date <= year_end,
        OvertimeRegistration.status.in_([
            OvertimeRegistrationStatus.APPROVED,
            OvertimeRegistrationStatus.PENDING,
        ]),
    )
    if employee_id:
        query = query.where(OvertimeRegistration.employee_id == employee_id)

    res = await db.execute(query)
    regs = res.scalars().all()

    missing_emp_ids = list({str(r.employee_id) for r in regs if str(r.employee_id) not in emp_map})
    if missing_emp_ids:
        extra = await hr_client.get_employees_batch(missing_emp_ids, token=token)
        for k, v in extra.items():
            if v:
                emp_map[k] = v

    stats_by_emp: dict[str, dict] = {}
    target_emp_ids = [employee_id] if employee_id else list(emp_map.keys())
    for eid in target_emp_ids:
        stats_by_emp[str(eid)] = {
            "month_approved_hours": 0.0,
            "month_pending_hours": 0.0,
            "month_count": 0,
            "year_approved_hours": 0.0,
            "year_pending_hours": 0.0,
            "year_count": 0,
        }

    for r in regs:
        eid = str(r.employee_id)
        if eid not in stats_by_emp:
            stats_by_emp[eid] = {
                "month_approved_hours": 0.0,
                "month_pending_hours": 0.0,
                "month_count": 0,
                "year_approved_hours": 0.0,
                "year_pending_hours": 0.0,
                "year_count": 0,
            }
        hrs = float(r.total_hours or 0.0)
        in_month = month_start <= r.date < next_month
        if r.status == OvertimeRegistrationStatus.APPROVED:
            stats_by_emp[eid]["year_approved_hours"] += hrs
            stats_by_emp[eid]["year_count"] += 1
            if in_month:
                stats_by_emp[eid]["month_approved_hours"] += hrs
                stats_by_emp[eid]["month_count"] += 1
        elif r.status == OvertimeRegistrationStatus.PENDING:
            stats_by_emp[eid]["year_pending_hours"] += hrs
            if in_month:
                stats_by_emp[eid]["month_pending_hours"] += hrs

    items = []
    for eid, st in stats_by_emp.items():
        emp = emp_map.get(eid, {}) or {}
        emp_dept_id = str(emp.get("department_id")) if emp.get("department_id") else None
        if department_id and emp_dept_id not in department_id:
            continue
        m_app = round(st["month_approved_hours"], 1)
        m_pend = round(st["month_pending_hours"], 1)
        y_app = round(st["year_approved_hours"], 1)
        y_pend = round(st["year_pending_hours"], 1)
        items.append({
            "employee_id": eid,
            "employee_name": emp.get("full_name") or f"Nhân viên ({eid[:8]})",
            "employee_code": emp.get("employee_code"),
            "department_id": emp_dept_id,
            "department_name": emp.get("department_name") or "-",
            "year": target_year,
            "month": target_month,
            "month_approved_hours": m_app,
            "month_pending_hours": m_pend,
            "month_count": st["month_count"],
            "month_limit": OT_MONTHLY_LIMIT,
            "month_remaining_hours": round(max(0.0, OT_MONTHLY_LIMIT - m_app), 1),
            "year_approved_hours": y_app,
            "year_pending_hours": y_pend,
            "year_count": st["year_count"],
            "year_limit": OT_YEARLY_LIMIT,
            "year_remaining_hours": round(max(0.0, OT_YEARLY_LIMIT - y_app), 1),
        })

    items.sort(key=lambda x: (x["employee_name"] or "").lower())
    return items


@router.get("/{reg_id}", response_model=OvertimeRegistrationResponse)
async def get_overtime_registration(
    reg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(OvertimeRegistration).where(OvertimeRegistration.id == reg_id)
    )
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đăng ký thêm giờ")
    emp = await hr_client.get_employee(str(reg.employee_id))
    return build_overtime_registration_response(reg, emp=emp)


@router.post("", response_model=OvertimeRegistrationResponse, status_code=201)
async def create_overtime_registration(
    body: OvertimeRegistrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_overtime')),
):
    employee_id = body.employee_id
    scope = perms.get("scope", "self")
    if scope == "self" and str(employee_id) != str(current_user.get("employee_id")):
        raise ForbiddenError(detail="Bạn chỉ có thể tạo đăng ký thêm giờ cho chính mình")

    await LeaveService.check_month_finalized(db, body.date)
    await _validate_ot_limits(db, str(employee_id), body.date, float(body.total_hours or 0.0))

    reg_data = body.model_dump()
    reg_data["employee_id"] = employee_id
    reg_data["status"] = OvertimeRegistrationStatus.PENDING

    reg = OvertimeRegistration(**reg_data)
    db.add(reg)
    await db.flush()

    try:
        await create_notification(
            db,
            employee_id=str(employee_id),
            title="Đã gửi đăng ký làm thêm giờ",
            message=f"Đơn đăng ký làm thêm ngày {body.date.strftime('%d/%m/%Y')} ({body.total_hours}h) đang chờ phê duyệt.",
            type="overtime_created",
        )
    except Exception as e:
        logger.warning(f"Overtime create notification warning: {e}")

    await db.commit()

    result = await db.execute(select(OvertimeRegistration).where(OvertimeRegistration.id == reg.id))
    reg = result.scalar_one()
    emp = await hr_client.get_employee(str(reg.employee_id))
    return build_overtime_registration_response(reg, emp=emp)


@router.put("/{reg_id}", response_model=OvertimeRegistrationResponse)
async def update_overtime_registration(
    reg_id: str,
    body: OvertimeRegistrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    result = await db.execute(select(OvertimeRegistration).where(OvertimeRegistration.id == reg_id))
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đăng ký thêm giờ")
    if reg.status != OvertimeRegistrationStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể sửa yêu cầu đăng ký làm thêm giờ khi đang ở trạng thái chờ duyệt")

    is_admin = bool(
        current_user.get("is_super_admin")
        or current_user.get("role") in ("admin", "superadmin", "super_admin")
        or perms.get("can_manage_overtime")
        or perms.get("can_approve_overtime")
    )
    is_owner = str(reg.employee_id) == str(current_user.get("employee_id"))
    if not (is_admin or is_owner):
        raise ForbiddenError(detail="Bạn không có quyền chỉnh sửa đơn đăng ký này")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reg, key, value)

    await LeaveService.check_month_finalized(db, reg.date)
    await _validate_ot_limits(db, str(reg.employee_id), reg.date, float(reg.total_hours or 0.0), exclude_reg_id=str(reg.id))

    await db.commit()

    emp = await hr_client.get_employee(str(reg.employee_id))
    return build_overtime_registration_response(reg, emp=emp)


@router.post("/{reg_id}/approve", response_model=OvertimeRegistrationResponse)
async def approve_overtime_registration(
    reg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_overtime')),
):
    result = await db.execute(select(OvertimeRegistration).where(OvertimeRegistration.id == reg_id))
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đăng ký thêm giờ")
    if reg.status != OvertimeRegistrationStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể duyệt đơn đang chờ")

    await LeaveService.check_month_finalized(db, reg.date)

    reg.status = OvertimeRegistrationStatus.APPROVED
    reg.approved_by_id = current_user.get("id")
    reg.approved_at = datetime.now(timezone.utc)

    # Tự động cập nhật lịch trực khi duyệt đơn thêm giờ thành công
    await sync_overtime_to_schedule(
        db,
        reg,
        approver_id=current_user.get("id"),
        auth_token=current_user.get("_token", ""),
    )

    try:
        await create_notification(
            db,
            employee_id=str(reg.employee_id),
            title="Đăng ký làm thêm giờ đã được duyệt",
            message=f"Đơn làm thêm giờ ngày {reg.date.strftime('%d/%m/%Y')} ({reg.total_hours}h) đã được phê duyệt.",
            type="overtime_approved",
        )
    except Exception:
        pass

    await db.commit()
    await db.refresh(reg)

    emp = await hr_client.get_employee(str(reg.employee_id))
    return build_overtime_registration_response(reg, emp=emp)


@router.post("/{reg_id}/reject", response_model=OvertimeRegistrationResponse)
async def reject_overtime_registration(
    reg_id: str,
    body: OvertimeRegistrationAction = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_overtime')),
):
    result = await db.execute(select(OvertimeRegistration).where(OvertimeRegistration.id == reg_id))
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đăng ký thêm giờ")
    if reg.status != OvertimeRegistrationStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể từ chối đơn đang chờ")

    reg.status = OvertimeRegistrationStatus.REJECTED
    reg.rejection_reason = body.rejection_reason

    try:
        await create_notification(
            db,
            employee_id=str(reg.employee_id),
            title="Đăng ký làm thêm giờ bị từ chối",
            message=f"Đơn làm thêm giờ ngày {reg.date.strftime('%d/%m/%Y')} ({reg.total_hours}h) đã bị từ chối. Lý do: {body.rejection_reason or 'Không có'}",
            type="overtime_rejected",
        )
    except Exception:
        pass

    await db.commit()
    await db.refresh(reg)

    emp = await hr_client.get_employee(str(reg.employee_id))
    return build_overtime_registration_response(reg, emp=emp)


@router.post("/bulk-approve")
async def bulk_approve_overtime(
    body: BulkApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_overtime')),
):
    errors = []
    approved = []
    auth_token = current_user.get("_token", "")
    approver_id = current_user.get("id")

    for rid in body.registration_ids:
        reg = await db.get(OvertimeRegistration, rid)
        if not reg:
            errors.append({"id": rid, "error": "Không tìm thấy đăng ký"})
            continue
        if reg.status != OvertimeRegistrationStatus.PENDING:
            errors.append({"id": rid, "error": "Đơn không ở trạng thái chờ duyệt"})
            continue
        reg.status = OvertimeRegistrationStatus.APPROVED
        reg.approved_by_id = approver_id
        reg.approved_at = datetime.now(timezone.utc)

        # Tự động cập nhật lịch trực
        await sync_overtime_to_schedule(db, reg, approver_id=approver_id, auth_token=auth_token)
        approved.append(rid)
        try:
            await create_notification(
                db,
                employee_id=str(reg.employee_id),
                title="Đăng ký làm thêm giờ đã được duyệt",
                message=f"Đơn làm thêm giờ ngày {reg.date.strftime('%d/%m/%Y')} ({reg.total_hours}h) đã được phê duyệt.",
                type="overtime_approved",
            )
        except Exception:
            pass

    await db.commit()
    return {
        "success_count": len(approved),
        "errors": errors,
        "total": len(body.registration_ids),
    }


@router.post("/bulk-reject")
async def bulk_reject_overtime(
    body: BulkRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_overtime')),
):
    errors = []
    rejected = []
    for rid in body.registration_ids:
        reg = await db.get(OvertimeRegistration, rid)
        if not reg:
            errors.append({"id": rid, "error": "Không tìm thấy đăng ký"})
            continue
        if reg.status != OvertimeRegistrationStatus.PENDING:
            errors.append({"id": rid, "error": "Đơn không ở trạng thái chờ duyệt"})
            continue
        reg.status = OvertimeRegistrationStatus.REJECTED
        reg.rejection_reason = body.reason
        reg.approved_by_id = current_user.get("id")
        reg.approved_at = datetime.now(timezone.utc)
        rejected.append(rid)
        try:
            await create_notification(
                db,
                employee_id=str(reg.employee_id),
                title="Đăng ký làm thêm giờ bị từ chối",
                message=f"Đơn làm thêm giờ ngày {reg.date.strftime('%d/%m/%Y')} ({reg.total_hours}h) đã bị từ chối. Lý do: {body.reason}",
                type="overtime_rejected",
            )
        except Exception:
            pass
    await db.commit()
    return {
        "success_count": len(rejected),
        "errors": errors,
        "total": len(body.registration_ids),
    }


@router.delete("/{reg_id}")
async def delete_overtime_registration(
    reg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    result = await db.execute(select(OvertimeRegistration).where(OvertimeRegistration.id == reg_id))
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đăng ký thêm giờ")

    await LeaveService.check_month_finalized(db, reg.date)

    is_admin = bool(
        current_user.get("is_super_admin")
        or current_user.get("role") in ("admin", "superadmin", "super_admin")
        or perms.get("can_manage_overtime")
        or perms.get("can_approve_overtime")
    )
    is_owner = str(reg.employee_id) == str(current_user.get("employee_id"))
    if not (is_admin or is_owner):
        raise ForbiddenError(detail="Bạn không có quyền xóa đơn đăng ký này")

    if reg.status != OvertimeRegistrationStatus.PENDING and not is_admin:
        raise BadRequestError(detail="Chỉ có thể xóa yêu cầu đăng ký làm thêm giờ khi đang ở trạng thái chờ duyệt")

    reg.is_active = False
    await revert_overtime_schedule(db, reg)
    await db.commit()
    return {"message": "Đã xoá đăng ký thêm giờ"}
