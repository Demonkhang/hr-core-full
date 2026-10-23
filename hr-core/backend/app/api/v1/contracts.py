import os
import uuid
import logging
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.models.contract import Contract, ContractAppendix, ContractType, ContractStatus, ContractAppendixChangeType
from app.models.employee import Employee, EmployeeStatus
from app.models.department import Department
from app.models.workplace import Workplace
from app.models.user import User
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractRenewRequest,
    ContractTerminateRequest,
    ContractAppendixCreate,
    ContractAppendixResponse,
    ContractDashboardSummary,
)
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.services.calendar_sync_service import notify_calendar_offboard_employee

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "contracts")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _build_contract_response(contract: Contract, appendices: Optional[List[ContractAppendix]] = None) -> ContractResponse:
    today = date.today()
    days_rem = None
    is_expiring = False
    is_exp = False

    if contract.end_date and contract.status in (ContractStatus.ACTIVE, ContractStatus.PENDING_RENEWAL):
        days_rem = (contract.end_date - today).days
        if days_rem < 0:
            is_exp = True
        elif days_rem <= 30:
            is_expiring = True

    app_list = []
    source_apps = appendices if appendices is not None else getattr(contract, "appendices", [])
    if source_apps:
        app_list = [ContractAppendixResponse.model_validate(a) for a in source_apps]

    emp_name = None
    emp_code = None
    dept_name = None
    wp_name = None

    if getattr(contract, "employee", None):
        emp_name = contract.employee.full_name
        emp_code = contract.employee.employee_code
    if getattr(contract, "department", None):
        dept_name = contract.department.name
    if getattr(contract, "workplace", None):
        wp_name = contract.workplace.name

    return ContractResponse(
        id=contract.id,
        employee_id=contract.employee_id,
        contract_number=contract.contract_number,
        contract_type=contract.contract_type,
        contract_sequence=contract.contract_sequence or 1,
        start_date=contract.start_date,
        end_date=contract.end_date,
        signing_date=contract.signing_date,
        signatory_name=contract.signatory_name,
        signatory_title=contract.signatory_title,
        job_title=contract.job_title,
        department_id=contract.department_id,
        workplace_id=contract.workplace_id,
        basic_salary=contract.basic_salary,
        salary_rate=contract.salary_rate or 100,
        allowance_amount=contract.allowance_amount or Decimal("0"),
        working_hours_description=contract.working_hours_description,
        notes=contract.notes,
        status=contract.status,
        termination_date=contract.termination_date,
        termination_reason=contract.termination_reason,
        file_attachment_url=contract.file_attachment_url,
        employee_name=emp_name,
        employee_code=emp_code,
        department_name=dept_name,
        workplace_name=wp_name,
        days_remaining=days_rem,
        is_expiring_soon=is_expiring,
        is_expired=is_exp,
        appendices=app_list,
        created_at=contract.created_at,
        updated_at=contract.updated_at,
    )


@router.get("/dashboard-summary", response_model=ContractDashboardSummary)
async def get_contracts_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Thống kê tổng quan hợp đồng và số lượng sắp hết hạn."""
    today = date.today()
    res = await db.execute(
        select(Contract).where(Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.PENDING_RENEWAL]))
    )
    active_contracts = res.scalars().all()

    summary = ContractDashboardSummary()
    summary.total_active = len(active_contracts)

    for c in active_contracts:
        if c.contract_type == ContractType.INDEFINITE_TERM:
            summary.indefinite_count += 1
        elif c.contract_type == ContractType.DEFINITE_TERM:
            summary.definite_count += 1
        elif c.contract_type == ContractType.PROBATION:
            summary.probation_count += 1

        if c.end_date:
            days = (c.end_date - today).days
            if days < 0:
                summary.overdue_count += 1
            else:
                if days <= 15:
                    summary.expiring_15_days += 1
                if days <= 30:
                    summary.expiring_30_days += 1
                if days <= 60:
                    summary.expiring_60_days += 1

    return summary


@router.get("", response_model=List[ContractResponse])
async def list_contracts(
    employee_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    contract_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    expiry_window: Optional[str] = Query(None, description="15_days, 30_days, 60_days, overdue, active"),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Danh sách hợp đồng lao động có lọc theo phòng ban, nhân viên, thời hạn."""
    query = (
        select(Contract)
        .options(
            selectinload(Contract.employee),
            selectinload(Contract.department),
            selectinload(Contract.workplace),
            selectinload(Contract.appendices),
        )
    )

    from datetime import timedelta

    if employee_id and isinstance(employee_id, (str, uuid.UUID)):
        query = query.where(Contract.employee_id == employee_id)
    if department_id and isinstance(department_id, (str, uuid.UUID)):
        query = query.where(Contract.department_id == department_id)
    if contract_type and isinstance(contract_type, str):
        query = query.where(Contract.contract_type == contract_type)
    if status and isinstance(status, str):
        query = query.where(Contract.status == status)

    today = date.today()
    if expiry_window == "15_days":
        # Sắp hết hạn trong 15 ngày tới
        query = query.where(
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.PENDING_RENEWAL]),
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= today + timedelta(days=15),
        )
    elif expiry_window == "30_days":
        # Sắp hết hạn trong 30 ngày tới
        query = query.where(
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.PENDING_RENEWAL]),
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= today + timedelta(days=30),
        )
    elif expiry_window == "60_days":
        # Sắp hết hạn trong 60 ngày tới
        query = query.where(
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.PENDING_RENEWAL]),
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= today + timedelta(days=60),
        )
    elif expiry_window == "overdue":
        # Đã quá hạn
        query = query.where(
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.PENDING_RENEWAL]),
            Contract.end_date.isnot(None),
            Contract.end_date < today,
        )

    if search and isinstance(search, str) and search.strip():
        s = f"%{search.strip()}%"
        query = query.join(Employee, Contract.employee_id == Employee.id).where(
            or_(
                Contract.contract_number.ilike(s),
                Employee.full_name.ilike(s),
                Employee.employee_code.ilike(s),
            )
        )

    query = query.order_by(Contract.start_date.desc(), Contract.created_at.desc())

    res = await db.execute(query)
    contracts = res.scalars().all()

    return [_build_contract_response(c) for c in contracts]


@router.post("", response_model=ContractResponse, status_code=201)
async def create_contract(
    body: ContractCreate,
    force: bool = Query(False, description="Bỏ qua cảnh báo đã ký quá 2 lần HĐ xác định thời hạn"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Tạo mới hợp đồng lao động, có kiểm tra pháp lý BLLĐ 2019."""
    # Kiểm tra nhân viên tồn tại
    emp = await db.get(Employee, body.employee_id)
    if not emp:
        raise NotFoundError("Không tìm thấy nhân viên")

    # Kiểm tra số hợp đồng trùng lặp
    dup = await db.execute(select(Contract).where(Contract.contract_number == body.contract_number))
    if dup.scalar_one_or_none():
        raise BadRequestError(f"Số hợp đồng '{body.contract_number}' đã tồn tại trong hệ thống")

    # Kiểm tra tuân thủ Điều 20 Bộ luật Lao động 2019:
    # Nếu tạo HĐ xác định thời hạn (definite_term):
    existing_definite_res = await db.execute(
        select(func.count(Contract.id)).where(
            Contract.employee_id == body.employee_id,
            Contract.contract_type == ContractType.DEFINITE_TERM,
            Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.RENEWED, ContractStatus.EXPIRED]),
        )
    )
    definite_count = existing_definite_res.scalar() or 0

    if body.contract_type == ContractType.DEFINITE_TERM:
        if definite_count >= 2 and not force:
            raise BadRequestError(
                f"Nhân viên {emp.full_name} đã ký {definite_count} lần hợp đồng xác định thời hạn. "
                "Theo Khoản 2 Điều 20 Bộ luật Lao động 2019, lần ký tiếp theo bắt buộc phải là "
                "Hợp đồng không xác định thời hạn. (Nếu trường hợp ngoại lệ theo luật, thêm tham số force=true)"
            )
        sequence = definite_count + 1
    else:
        sequence = body.contract_sequence or 1

    # Tự động gán phòng ban & nơi làm việc từ nhân viên nếu chưa chọn
    dept_id = body.department_id or emp.department_id
    wp_id = body.workplace_id or emp.workplace_id

    contract = Contract(
        employee_id=body.employee_id,
        contract_number=body.contract_number,
        contract_type=body.contract_type,
        contract_sequence=sequence,
        start_date=body.start_date,
        end_date=body.end_date,
        signing_date=body.signing_date,
        signatory_name=body.signatory_name,
        signatory_title=body.signatory_title,
        job_title=body.job_title or emp.position,
        department_id=dept_id,
        workplace_id=wp_id,
        basic_salary=body.basic_salary,
        salary_rate=body.salary_rate or 100,
        allowance_amount=body.allowance_amount or Decimal("0"),
        working_hours_description=body.working_hours_description,
        status=ContractStatus.ACTIVE,
        file_attachment_url=body.file_attachment_url,
        notes=body.notes,
    )
    db.add(contract)
    await db.commit()

    # Load lại kèm quan hệ
    contract_res = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.employee),
            selectinload(Contract.department),
            selectinload(Contract.workplace),
            selectinload(Contract.appendices),
        )
        .where(Contract.id == contract.id)
    )
    saved = contract_res.scalar_one()
    return _build_contract_response(saved)


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy chi tiết một hợp đồng lao động."""
    res = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.employee),
            selectinload(Contract.department),
            selectinload(Contract.workplace),
            selectinload(Contract.appendices),
        )
        .where(Contract.id == contract_id)
    )
    contract = res.scalar_one_or_none()
    if not contract:
        raise NotFoundError("Không tìm thấy hợp đồng lao động")
    return _build_contract_response(contract)


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: str,
    body: ContractUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Cập nhật thông tin hợp đồng."""
    res = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = res.scalar_one_or_none()
    if not contract:
        raise NotFoundError("Không tìm thấy hợp đồng lao động")

    update_data = body.model_dump(exclude_unset=True)
    if "contract_number" in update_data and update_data["contract_number"] != contract.contract_number:
        dup = await db.execute(select(Contract).where(Contract.contract_number == update_data["contract_number"]))
        if dup.scalar_one_or_none():
            raise BadRequestError(f"Số hợp đồng '{update_data['contract_number']}' đã tồn tại")

    for k, v in update_data.items():
        setattr(contract, k, v)

    await db.commit()

    reloaded = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.employee),
            selectinload(Contract.department),
            selectinload(Contract.workplace),
            selectinload(Contract.appendices),
        )
        .where(Contract.id == contract.id)
    )
    return _build_contract_response(reloaded.scalar_one())


@router.delete("/{contract_id}")
async def delete_contract(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Xóa hợp đồng lao động."""
    res = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = res.scalar_one_or_none()
    if not contract:
        raise NotFoundError("Không tìm thấy hợp đồng lao động")

    await db.delete(contract)
    await db.commit()
    return {"message": "Đã xóa hợp đồng thành công"}


@router.post("/{contract_id}/renew", response_model=ContractResponse)
async def renew_contract(
    contract_id: str,
    body: ContractRenewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Ký tiếp / Gia hạn hợp đồng: Chuyển HĐ cũ sang 'renewed' và tạo HĐ mới nối tiếp."""
    res = await db.execute(
        select(Contract).options(selectinload(Contract.employee)).where(Contract.id == contract_id)
    )
    old_contract = res.scalar_one_or_none()
    if not old_contract:
        raise NotFoundError("Không tìm thấy hợp đồng cần gia hạn")

    dup = await db.execute(select(Contract).where(Contract.contract_number == body.contract_number))
    if dup.scalar_one_or_none():
        raise BadRequestError(f"Số hợp đồng mới '{body.contract_number}' đã tồn tại")

    # Đóng hợp đồng cũ
    old_contract.status = ContractStatus.RENEWED

    # Tính sequence mới
    new_sequence = (old_contract.contract_sequence or 1) + 1 if body.contract_type == old_contract.contract_type else 1

    new_contract = Contract(
        employee_id=old_contract.employee_id,
        contract_number=body.contract_number,
        contract_type=body.contract_type,
        contract_sequence=new_sequence,
        start_date=body.start_date,
        end_date=body.end_date,
        signing_date=body.signing_date,
        signatory_name=body.signatory_name or old_contract.signatory_name,
        signatory_title=body.signatory_title or old_contract.signatory_title,
        job_title=body.job_title or old_contract.job_title,
        department_id=old_contract.department_id,
        workplace_id=old_contract.workplace_id,
        basic_salary=body.basic_salary or old_contract.basic_salary,
        salary_rate=body.salary_rate or 100,
        allowance_amount=body.allowance_amount if body.allowance_amount is not None else old_contract.allowance_amount,
        working_hours_description=old_contract.working_hours_description,
        status=ContractStatus.ACTIVE,
        file_attachment_url=body.file_attachment_url,
        notes=body.notes,
    )
    db.add(new_contract)
    await db.commit()

    reloaded = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.employee),
            selectinload(Contract.department),
            selectinload(Contract.workplace),
            selectinload(Contract.appendices),
        )
        .where(Contract.id == new_contract.id)
    )
    return _build_contract_response(reloaded.scalar_one())


@router.post("/{contract_id}/terminate", response_model=ContractResponse)
async def terminate_contract(
    contract_id: str,
    body: ContractTerminateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Chấm dứt / Thanh lý hợp đồng lao động và tự động cập nhật trạng thái nhân viên."""
    res = await db.execute(select(Contract).where(Contract.id == contract_id))
    contract = res.scalar_one_or_none()
    if not contract:
        raise NotFoundError("Không tìm thấy hợp đồng lao động")

    contract.status = ContractStatus.TERMINATED
    contract.termination_date = body.termination_date
    contract.termination_reason = body.termination_reason

    # Tự động cập nhật nhân viên sang đã nghỉ việc
    if body.deactivate_employee:
        emp = await db.get(Employee, contract.employee_id)
        if emp:
            emp.is_active = False
            emp.status = EmployeeStatus.RESIGNED
            logger.info(f"Deactivated employee {emp.id} due to contract termination")
            # Đồng bộ sang calendar-mgmt hủy lịch
            await notify_calendar_offboard_employee(str(emp.id))

    await db.commit()

    reloaded = await db.execute(
        select(Contract)
        .options(
            selectinload(Contract.employee),
            selectinload(Contract.department),
            selectinload(Contract.workplace),
            selectinload(Contract.appendices),
        )
        .where(Contract.id == contract.id)
    )
    return _build_contract_response(reloaded.scalar_one())


# ==========================================
# PHỤ LỤC HỢP ĐỒNG (APPENDICES)
# ==========================================

@router.get("/{contract_id}/appendices", response_model=List[ContractAppendixResponse])
async def list_appendices(
    contract_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Danh sách phụ lục của hợp đồng."""
    res = await db.execute(
        select(ContractAppendix)
        .where(ContractAppendix.contract_id == contract_id)
        .order_by(ContractAppendix.signing_date.asc())
    )
    appendices = res.scalars().all()
    return [ContractAppendixResponse.model_validate(a) for a in appendices]


@router.post("/{contract_id}/appendices", response_model=ContractAppendixResponse, status_code=201)
async def create_appendix(
    contract_id: str,
    body: ContractAppendixCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Thêm phụ lục hợp đồng và cập nhật các thông tin tương ứng vào hợp đồng gốc."""
    contract = await db.get(Contract, contract_id)
    if not contract:
        raise NotFoundError("Không tìm thấy hợp đồng lao động")

    appendix = ContractAppendix(
        contract_id=contract_id,
        appendix_number=body.appendix_number,
        effective_date=body.effective_date,
        change_type=body.change_type,
        content=body.content,
        new_basic_salary=body.new_basic_salary,
        new_end_date=body.new_end_date,
        file_attachment_url=body.file_attachment_url,
        signing_date=body.signing_date,
    )
    db.add(appendix)

    # Nếu phụ lục có điều chỉnh lương hoặc thời hạn, đồng bộ sang hợp đồng
    if body.new_basic_salary is not None:
        contract.basic_salary = body.new_basic_salary
    if body.new_end_date is not None:
        contract.end_date = body.new_end_date

    await db.commit()
    await db.refresh(appendix)
    return ContractAppendixResponse.model_validate(appendix)


@router.delete("/{contract_id}/appendices/{appendix_id}")
async def delete_appendix(
    contract_id: str,
    appendix_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Xóa phụ lục hợp đồng."""
    appendix = await db.get(ContractAppendix, appendix_id)
    if not appendix or str(appendix.contract_id) != contract_id:
        raise NotFoundError("Không tìm thấy phụ lục hợp đồng")

    await db.delete(appendix)
    await db.commit()
    return {"message": "Đã xóa phụ lục hợp đồng"}


# ==========================================
# UPLOAD FILE SCAN HỢP ĐỒNG (ATTACHMENTS)
# ==========================================

@router.post("/upload-attachment")
async def upload_contract_attachment(
    file: UploadFile = File(...),
    current_user: User = Depends(RequirePermission("can_manage_employees")),
):
    """Upload file scan hợp đồng (PDF hoặc ảnh)."""
    allowed_exts = [".pdf", ".jpg", ".jpeg", ".png", ".webp"]
    _, ext = os.path.splitext(file.filename or "")
    if ext.lower() not in allowed_exts:
        raise BadRequestError(f"Định dạng file không được hỗ trợ. Vui lòng chọn: {', '.join(allowed_exts)}")

    filename = f"contract_{uuid.uuid4().hex[:12]}{ext.lower()}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    file_url = f"/uploads/contracts/{filename}"
    return {
        "file_url": file_url,
        "filename": file.filename,
        "size": len(content),
    }
