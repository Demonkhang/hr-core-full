import logging
from typing import Optional, List
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, Query, Request, Body
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission
from app.api.v1.helpers import build_leave_registration_response
from app.schemas.leave_registration import LeaveRegistrationCreate, LeaveRegistrationUpdate, LeaveRegistrationResponse, LeaveRegistrationAction
from app.models.leave_registration import LeaveRegistration, LeaveRegistrationStatus, LeaveType
from app.models.schedule import Schedule, ScheduleStatus
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.services.leave_service import LeaveService
from app.clients.hr_client import hr_client

logger = logging.getLogger(__name__)

router = APIRouter()


async def _fetch_employee(employee_id: str) -> Optional[dict]:
    """Fetch a single employee using the batch endpoint (no auth required)."""
    emp_map = await hr_client.get_employees_batch([employee_id])
    return emp_map.get(employee_id)


class BulkApproveRequest(BaseModel):
    registration_ids: list[str]


class BulkRejectRequest(BaseModel):
    registration_ids: list[str]
    reason: str


async def _get_registration(reg_id: str, db: AsyncSession):
    result = await db.execute(
        select(LeaveRegistration).where(LeaveRegistration.id == reg_id)
    )
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đơn xin nghỉ phép")
    return reg


@router.get("", response_model=List[LeaveRegistrationResponse])
async def list_leave_registrations(
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
    query = select(LeaveRegistration)
    if active_only:
        query = query.where(LeaveRegistration.is_active == True)
    if employee_id:
        query = query.where(LeaveRegistration.employee_id == employee_id)
    if status:
        query = query.where(LeaveRegistration.status == status)
    if date_from:
        query = query.where(LeaveRegistration.start_date >= date_from)
    if date_to:
        query = query.where(LeaveRegistration.end_date <= date_to)

    query = query.order_by(LeaveRegistration.start_date.desc(), LeaveRegistration.created_at.desc())
    result = await db.execute(query)
    registrations = result.scalars().all()

    emp_ids = list(set(str(r.employee_id) for r in registrations))
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    return [build_leave_registration_response(r, emp=emp_map.get(str(r.employee_id))) for r in registrations]


@router.get("/{reg_id}", response_model=LeaveRegistrationResponse)
async def get_leave_registration(
    reg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    reg = await _get_registration(reg_id, db)
    emp = await _fetch_employee(str(reg.employee_id))
    return build_leave_registration_response(reg, emp=emp)


@router.post("", response_model=LeaveRegistrationResponse, status_code=201)
async def create_leave_registration(
    body: LeaveRegistrationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    employee_id = body.employee_id
    emp = await _fetch_employee(employee_id)
    if not emp:
        raise NotFoundError(detail="Không tìm thấy nhân viên")

    total_days = LeaveService.calculate_total_days(
        body.start_date, body.end_date, body.start_session, body.end_session
    )
    if total_days <= 0:
        raise BadRequestError(detail="Số ngày nghỉ tính ra phải lớn hơn 0")

    if body.leave_type == LeaveType.ANNUAL:
        balance = await LeaveService.get_or_create_balance(db, employee_id, body.start_date.year)
        if balance.remaining < total_days:
            raise BadRequestError(
                detail=f"Không đủ ngày phép năm (Yêu cầu: {total_days} ngày, Quỹ phép còn lại: {balance.remaining} ngày)"
            )

    reg_data = body.model_dump()
    reg_data["employee_id"] = employee_id
    reg_data["total_days"] = total_days
    reg_data["status"] = LeaveRegistrationStatus.PENDING

    reg = LeaveRegistration(**reg_data)
    db.add(reg)
    await db.commit()

    result = await db.execute(select(LeaveRegistration).where(LeaveRegistration.id == reg.id))
    reg = result.scalar_one()
    return build_leave_registration_response(reg, emp=emp)


@router.put("/{reg_id}", response_model=LeaveRegistrationResponse)
async def update_leave_registration(
    reg_id: str,
    body: LeaveRegistrationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    reg = await _get_registration(reg_id, db)

    if reg.status != LeaveRegistrationStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể sửa đơn khi đang ở trạng thái chờ duyệt")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reg, key, value)

    total_days = LeaveService.calculate_total_days(
        reg.start_date, reg.end_date, reg.start_session, reg.end_session
    )
    reg.total_days = total_days

    if reg.leave_type == LeaveType.ANNUAL:
        balance = await LeaveService.get_or_create_balance(db, reg.employee_id, reg.start_date.year)
        if balance.remaining < total_days:
            raise BadRequestError(
                detail=f"Không đủ ngày phép năm (Yêu cầu: {total_days} ngày, Quỹ phép còn lại: {balance.remaining} ngày)"
            )

    await db.commit()
    await db.refresh(reg)
    emp = await _fetch_employee(str(reg.employee_id))
    return build_leave_registration_response(reg, emp=emp)


@router.post("/{reg_id}/approve", response_model=LeaveRegistrationResponse)
async def approve_leave_registration(
    reg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_leave')),
):
    reg = await _get_registration(reg_id, db)
    if reg.status != LeaveRegistrationStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể duyệt đơn đang ở trạng thái chờ duyệt")

    reg.status = LeaveRegistrationStatus.APPROVED
    reg.approved_by_id = current_user.get("id")
    reg.approved_at = datetime.now(timezone.utc)

    await LeaveService.recalculate_leave_balance(db, str(reg.employee_id), reg.start_date.year)

    overlap_schedules = await db.execute(
        select(Schedule).where(
            Schedule.employee_id == reg.employee_id,
            Schedule.date >= reg.start_date,
            Schedule.date <= reg.end_date,
            Schedule.status != ScheduleStatus.CANCELLED
        )
    )
    for sched in overlap_schedules.scalars().all():
        sched.status = ScheduleStatus.CANCELLED

    await db.commit()
    await db.refresh(reg)
    emp = await _fetch_employee(str(reg.employee_id))
    return build_leave_registration_response(reg, emp=emp)


@router.post("/{reg_id}/reject", response_model=LeaveRegistrationResponse)
async def reject_leave_registration(
    reg_id: str,
    body: LeaveRegistrationAction = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_leave')),
):
    reg = await _get_registration(reg_id, db)
    if reg.status != LeaveRegistrationStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể từ chối đơn đang ở trạng thái chờ duyệt")

    reg.status = LeaveRegistrationStatus.REJECTED
    reg.rejection_reason = body.rejection_reason
    await db.commit()

    reg = await _get_registration(reg_id, db)
    emp = await _fetch_employee(str(reg.employee_id))
    return build_leave_registration_response(reg, emp=emp)


@router.post("/bulk-approve")
async def bulk_approve_leave(
    body: BulkApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_leave')),
):
    errors = []
    approved = []
    for rid in body.registration_ids:
        reg = await db.get(LeaveRegistration, rid)
        if not reg:
            errors.append({"id": rid, "error": "Không tìm thấy đơn"})
            continue
        if reg.status != LeaveRegistrationStatus.PENDING:
            errors.append({"id": rid, "error": "Đơn không ở trạng thái chờ duyệt"})
            continue
        reg.status = LeaveRegistrationStatus.APPROVED
        reg.approved_by_id = current_user.get("id")
        reg.approved_at = datetime.now(timezone.utc)
        approved.append(rid)
    await db.commit()
    for rid in approved:
        reg = await db.get(LeaveRegistration, rid)
        if reg and reg.leave_type == LeaveType.ANNUAL:
            await LeaveService.recalculate_leave_balance(db, str(reg.employee_id), reg.start_date.year)
    return {
        "success_count": len(approved),
        "errors": errors,
        "total": len(body.registration_ids),
    }


@router.post("/bulk-reject")
async def bulk_reject_leave(
    body: BulkRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_leave')),
):
    errors = []
    rejected = []
    for rid in body.registration_ids:
        reg = await db.get(LeaveRegistration, rid)
        if not reg:
            errors.append({"id": rid, "error": "Không tìm thấy đơn"})
            continue
        if reg.status != LeaveRegistrationStatus.PENDING:
            errors.append({"id": rid, "error": "Đơn không ở trạng thái chờ duyệt"})
            continue
        reg.status = LeaveRegistrationStatus.REJECTED
        reg.rejection_reason = body.reason
        reg.approved_by_id = current_user.get("id")
        reg.approved_at = datetime.now(timezone.utc)
        rejected.append(rid)
    await db.commit()
    return {
        "success_count": len(rejected),
        "errors": errors,
        "total": len(body.registration_ids),
    }


@router.delete("/{reg_id}")
async def delete_leave_registration(
    reg_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    result = await db.execute(select(LeaveRegistration).where(LeaveRegistration.id == reg_id))
    reg = result.scalar_one_or_none()
    if not reg:
        raise NotFoundError(detail="Không tìm thấy đơn nghỉ phép")

    old_status = reg.status
    reg.status = LeaveRegistrationStatus.CANCELLED
    reg.is_active = False
    await db.flush()

    if old_status == LeaveRegistrationStatus.APPROVED:
        await LeaveService.recalculate_leave_balance(db, str(reg.employee_id), reg.start_date.year)

    await db.commit()
    return {"message": "Đã huỷ đơn nghỉ phép thành công"}
