import logging
from typing import Optional, List
from datetime import datetime, timezone, date
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

logger = logging.getLogger(__name__)

router = APIRouter()


class BulkApproveRequest(BaseModel):
    registration_ids: list[str]


class BulkRejectRequest(BaseModel):
    registration_ids: list[str]
    reason: str


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

    reg_data = body.model_dump()
    reg_data["employee_id"] = employee_id
    # Luôn luôn khởi tạo ở trạng thái PENDING (chờ duyệt)
    reg_data["status"] = OvertimeRegistrationStatus.PENDING

    reg = OvertimeRegistration(**reg_data)
    db.add(reg)
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
        raise BadRequestError(detail="Chỉ có thể sửa khi đang chờ duyệt")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reg, key, value)
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

    reg.status = OvertimeRegistrationStatus.APPROVED
    reg.approved_by_id = current_user.get("id")
    reg.approved_at = datetime.now(timezone.utc)
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
    for rid in body.registration_ids:
        reg = await db.get(OvertimeRegistration, rid)
        if not reg:
            errors.append({"id": rid, "error": "Không tìm thấy đăng ký"})
            continue
        if reg.status != OvertimeRegistrationStatus.PENDING:
            errors.append({"id": rid, "error": "Đơn không ở trạng thái chờ duyệt"})
            continue
        reg.status = OvertimeRegistrationStatus.APPROVED
        reg.approved_by_id = current_user.get("id")
        reg.approved_at = datetime.now(timezone.utc)
        approved.append(rid)
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
    reg.is_active = False
    await db.commit()
    return {"message": "Đã xoá đăng ký thêm giờ"}
