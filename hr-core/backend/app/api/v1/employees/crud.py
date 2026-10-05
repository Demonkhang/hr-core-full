import logging
from uuid import UUID
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.models.refresh_token import RefreshToken
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission, get_current_permissions, get_scope_filter
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse, EmployeeDeactivate
from app.models.user import User
from app.core.constants import RESPONSE_MESSAGES
from app.models.employee import Employee, EmployeeStatus
from app.models.department import Department
from app.models.position import Position
from app.models.workplace import Workplace
from app.models.job_position import JobPosition
from app.core.exceptions import NotFoundError, ConflictError, ForbiddenError
from app.services.employee_account_service import auto_provision_user
from app.services.audit_service import create_audit_log

logger = logging.getLogger(__name__)

router = APIRouter()


async def _build_employee_response_with_user(emp: Employee, user: User | None) -> EmployeeResponse:
    has_account = user is not None
    return EmployeeResponse(
        id=str(emp.id),
        department_id=str(emp.department_id),
        workplace_id=str(emp.workplace_id) if emp.workplace_id else None,
        position_id=str(emp.position_id) if emp.position_id else None,
        job_position_id=str(emp.job_position_id) if emp.job_position_id else None,
        full_name=emp.full_name,
        position=emp.position,
        phone=emp.phone,
        email=emp.email,
        employee_code=emp.employee_code,
        hire_date=emp.hire_date,
        is_active=emp.is_active,
        status=emp.status,
        department_name=emp.department.name if emp.department else None,
        workplace_name=emp.workplace.name if emp.workplace else None,
        position_name=emp.position_rel.name if emp.position_rel else None,
        job_position_name=emp.job_position.name if emp.job_position else None,
        has_account=has_account,
        user_id=str(user.id) if user else None,
        username=user.username if user else None,
        is_super_admin=user.is_super_admin if user else False,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


async def _build_employee_response(emp: Employee, db: AsyncSession = None) -> EmployeeResponse:
    user = None
    if db is not None:
        result = await db.execute(select(User).where(User.employee_id == emp.id))
        user = result.scalar_one_or_none()
    return await _build_employee_response_with_user(emp, user)


@router.get("", response_model=list[EmployeeResponse])
async def list_employees(
    department_id: Optional[List[str]] = Query(None),
    active_only: bool = Query(True),
    search: Optional[str] = Query(None),
    include_accounts: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    query = select(Employee).options(
        selectinload(Employee.department),
        selectinload(Employee.workplace),
        selectinload(Employee.position_rel),
        selectinload(Employee.job_position),
    )
    if active_only:
        query = query.where(Employee.is_active == True)
    scope_filter = get_scope_filter(perms, current_user)
    if scope_filter["employee_id"]:
        query = query.where(Employee.id == scope_filter["employee_id"])
    elif scope_filter["department_id"]:
        query = query.where(Employee.department_id == scope_filter["department_id"])
    elif department_id:
        query = query.where(Employee.department_id.in_(department_id))
    if search:
        query = query.where(Employee.full_name.ilike(f"%{search}%"))
    query = query.order_by(Employee.full_name)

    result = await db.execute(query)
    employees = result.scalars().all()

    if include_accounts:
        emp_ids = [e.id for e in employees]
        if emp_ids:
            user_result = await db.execute(
                select(User).where(User.employee_id.in_(emp_ids))
            )
            users = user_result.scalars().all()
            user_map = {u.employee_id: u for u in users}
        else:
            user_map = {}
        return [
            await _build_employee_response_with_user(e, user_map.get(e.id))
            for e in employees
        ]

    return [
        await _build_employee_response_with_user(e, None)
        for e in employees
    ]


@router.get("/{emp_id}", response_model=EmployeeResponse)
async def get_employee(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    scope_filter = get_scope_filter(perms, current_user)
    query = select(Employee).options(
        selectinload(Employee.department),
        selectinload(Employee.workplace),
        selectinload(Employee.position_rel),
        selectinload(Employee.job_position),
    ).where(Employee.id == emp_id)

    if scope_filter["employee_id"]:
        query = query.where(Employee.id == scope_filter["employee_id"])
    elif scope_filter["department_id"]:
        query = query.where(Employee.department_id == scope_filter["department_id"])

    result = await db.execute(query)
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])
    return await _build_employee_response(emp, db)


@router.post("", response_model=EmployeeResponse, status_code=201)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_employees')),
):
    # Kiểm tra scope: ngăn IDOR / leo thang đặc quyền.
    # - scope=organization: được tạo ở bất kỳ phòng ban nào.
    # - scope=department  : chỉ được tạo trong phòng ban của chính mình.
    # - scope=self        : không được tạo nhân viên mới (ngoài phạm vi).
    scope_filter = get_scope_filter(perms, current_user)
    if scope_filter["employee_id"]:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    if scope_filter["department_id"] and str(body.department_id) != scope_filter["department_id"]:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])

    dept = await db.get(Department, body.department_id)
    if not dept:
        raise NotFoundError(detail=RESPONSE_MESSAGES["DEPARTMENT_NOT_FOUND"])

    if body.employee_code:
        existing = await db.execute(select(Employee).where(Employee.employee_code == body.employee_code))
        if existing.scalar_one_or_none():
            raise ConflictError(detail=RESPONSE_MESSAGES["EMPLOYEE_CODE_EXISTS"])

    emp = Employee(**body.model_dump(exclude={"create_account"}))
    db.add(emp)
    await db.flush()

    if body.create_account:
        try:
            await auto_provision_user(db, emp)
            await db.flush()
        except HTTPException as e:
            logger.warning("Account creation failed for employee %s: %s", emp.id, e.detail)

    result = await db.execute(
        select(Employee).options(
            selectinload(Employee.department),
            selectinload(Employee.workplace),
            selectinload(Employee.position_rel),
            selectinload(Employee.job_position),
        ).where(Employee.id == emp.id)
    )
    emp = result.scalar_one()
    await create_audit_log(
        db, action="employee.create", resource_type="employee",
        resource_id=str(emp.id), user_id=str(current_user.id),
        new_values={"full_name": emp.full_name, "employee_code": emp.employee_code}, success=True,
    )
    return await _build_employee_response(emp, db)


@router.put("/{emp_id}", response_model=EmployeeResponse)
async def update_employee(
    emp_id: str,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    try:
        result = await db.execute(
            select(Employee).options(
                selectinload(Employee.department),
                selectinload(Employee.workplace),
                selectinload(Employee.position_rel),
                selectinload(Employee.job_position),
            ).where(Employee.id == emp_id)
        )
        emp = result.scalar_one_or_none()
        if not emp:
            raise NotFoundError(detail="Không tìm thấy nhân viên")

        scope_filter = get_scope_filter(perms, current_user)
        if scope_filter["employee_id"] and emp.id != UUID(scope_filter["employee_id"]):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
        if scope_filter["department_id"] and str(emp.department_id) != scope_filter["department_id"]:
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])

        update_data = body.model_dump(exclude_unset=True)

        # Chống mass-assignment: is_active/status là thay đổi trạng thái (soft-delete /
        # khôi phục) và chỉ được thực hiện qua endpoint delete/restore (cần quyền
        # can_manage_employees). Không cho phép lách qua endpoint update.
        sensitive_fields = update_data.keys() & {"is_active", "status"}
        if sensitive_fields and not perms.get("can_manage_employees"):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])

        if "department_id" in update_data:
            dept = await db.get(Department, update_data["department_id"])
            if not dept:
                raise NotFoundError(detail=RESPONSE_MESSAGES["DEPARTMENT_NOT_FOUND"])

        if "workplace_id" in update_data and update_data["workplace_id"]:
            wp = await db.get(Workplace, update_data["workplace_id"])
            if not wp:
                raise NotFoundError(detail="Nơi làm việc không tồn tại")

        if "position_id" in update_data and update_data["position_id"]:
            pos = await db.get(Position, update_data["position_id"])
            if not pos:
                raise NotFoundError(detail="Chức vụ không tồn tại")

        if "job_position_id" in update_data and update_data["job_position_id"]:
            jp = await db.get(JobPosition, update_data["job_position_id"])
            if not jp:
                raise NotFoundError(detail="Vị trí việc làm không tồn tại")

        if "employee_code" in update_data and update_data["employee_code"]:
            existing = await db.execute(
                select(Employee).where(
                    Employee.employee_code == update_data["employee_code"],
                    Employee.id != emp_id,
                )
            )
            if existing.scalar_one_or_none():
                raise ConflictError(detail=RESPONSE_MESSAGES["EMPLOYEE_CODE_EXISTS"])

        old_values = {}
        for k in update_data.keys():
            if k.startswith("_"):
                continue
            v = getattr(emp, k, None)
            if isinstance(v, (date, datetime)):
                v = v.isoformat()
            elif isinstance(v, UUID):
                v = str(v)
            old_values[k] = v

        for key, value in update_data.items():
            if key == "employee_code" and value is None:
                setattr(emp, key, None)
            elif key in ("department_id", "workplace_id", "position_id", "job_position_id") and value is None:
                setattr(emp, key, None)
            else:
                setattr(emp, key, value)

        await db.flush()

        result = await db.execute(
            select(Employee).options(
                selectinload(Employee.department),
                selectinload(Employee.workplace),
                selectinload(Employee.position_rel),
            ).where(Employee.id == emp_id)
        )
        emp = result.scalar_one()

        new_vals = {}
        for k, v in update_data.items():
            if isinstance(v, (date, datetime)):
                new_vals[k] = v.isoformat()
            elif isinstance(v, UUID):
                new_vals[k] = str(v)
            else:
                new_vals[k] = v

        await create_audit_log(
            db, action="employee.update", resource_type="employee",
            resource_id=str(emp.id), user_id=str(current_user.id),
            old_values=old_values, new_values=new_vals, success=True,
        )
        return await _build_employee_response(emp, db)
    except (NotFoundError, ConflictError):
        raise
    except Exception:
        logger.exception(f"Lỗi cập nhật nhân viên {emp_id}")
        raise


@router.delete("/{emp_id}")
async def delete_employee(
    emp_id: str,
    permanent: bool = Query(False),
    body: Optional[EmployeeDeactivate] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_employees')),
):
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])
    scope_filter = get_scope_filter(perms, current_user)
    if scope_filter["employee_id"] and emp.id != UUID(scope_filter["employee_id"]):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    if scope_filter["department_id"] and str(emp.department_id) != scope_filter["department_id"]:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])

    if permanent:
        await db.execute(
            update(Department)
            .where(Department.head_id == emp.id)
            .values(head_id=None)
        )
        user_result = await db.execute(select(User).where(User.employee_id == emp.id))
        user = user_result.scalar_one_or_none()
        if user:
            await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
            await db.delete(user)

        await create_audit_log(
            db, action="employee.hard_delete", resource_type="employee",
            resource_id=emp_id, user_id=str(current_user.id),
            old_values={"full_name": emp.full_name, "employee_code": emp.employee_code},
            new_values=None, success=True,
        )
        await db.delete(emp)
        await db.flush()
        return {"message": "Đã xóa vĩnh viễn nhân viên khỏi hệ thống"}

    if not body or not body.status:
        raise HTTPException(status_code=400, detail="Vui lòng chọn lý do ngưng nhân viên")

    old_values = {"is_active": emp.is_active, "status": emp.status}
    emp.is_active = False
    emp.status = body.status

    user_result = await db.execute(select(User).where(User.employee_id == emp_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.is_active = False

    await create_audit_log(
        db, action="employee.deactivate", resource_type="employee",
        resource_id=emp_id, user_id=str(current_user.id),
        old_values=old_values, new_values={"is_active": False, "status": body.status}, success=True,
    )
    await db.flush()
    return {"message": RESPONSE_MESSAGES["EMPLOYEE_DEACTIVATED"]}


@router.patch("/{emp_id}/restore")
async def restore_employee(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_employees')),
):
    result = await db.execute(select(Employee).where(Employee.id == emp_id))
    emp = result.scalar_one_or_none()
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])
    scope_filter = get_scope_filter(perms, current_user)
    if scope_filter["employee_id"] and emp.id != UUID(scope_filter["employee_id"]):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    if scope_filter["department_id"] and str(emp.department_id) != scope_filter["department_id"]:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    old_values = {"is_active": emp.is_active, "status": emp.status}
    emp.is_active = True
    emp.status = EmployeeStatus.ACTIVE

    user_result = await db.execute(select(User).where(User.employee_id == emp_id))
    user = user_result.scalar_one_or_none()
    if user:
        user.is_active = True

    await create_audit_log(
        db, action="employee.restore", resource_type="employee",
        resource_id=emp_id, user_id=str(current_user.id),
        old_values=old_values, new_values={"is_active": True, "status": "active"}, success=True,
    )
    await db.flush()
    return {"message": "Đã khôi phục nhân viên"}
