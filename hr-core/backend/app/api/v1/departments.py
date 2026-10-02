from typing import Optional, List, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.exceptions import NotFoundError, BadRequestError, ConflictError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission, get_current_permissions
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentHead
from app.models.user import User
from app.models.department import Department
from app.models.employee import Employee
from app.services.audit_service import create_audit_log

router = APIRouter()


async def _validate_head(db: AsyncSession, head_id: Optional[str]) -> Optional[Employee]:
    if not head_id:
        return None
    try:
        head_uuid = UUID(head_id)
    except ValueError:
        raise BadRequestError(detail="ID lãnh đạo không hợp lệ")
    result = await db.execute(select(Employee).where(Employee.id == head_uuid))
    head = result.scalar_one_or_none()
    if not head:
        raise BadRequestError(detail="Lãnh đạo được chọn không tồn tại")
    return head


async def _build_response(db: AsyncSession, dept: Department, employee_count: int) -> DepartmentResponse:
    head = None
    if dept.head_id:
        result = await db.execute(select(Employee).where(Employee.id == dept.head_id))
        h = result.scalar_one_or_none()
        if h:
            head = DepartmentHead(id=str(h.id), full_name=h.full_name, employee_code=h.employee_code)
    return DepartmentResponse(
        id=str(dept.id),
        name=dept.name,
        code=dept.code,
        description=dept.description,
        is_active=dept.is_active,
        head_id=str(dept.head_id) if dept.head_id else None,
        head=head,
        employee_count=employee_count,
        created_at=dept.created_at,
        updated_at=dept.updated_at,
    )


@router.get("", response_model=List[DepartmentResponse])
async def list_departments(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Department)
    if active_only:
        query = query.where(Department.is_active == True)
    query = query.order_by(Department.name)
    result = await db.execute(query)
    departments = result.scalars().all()

    emp_counts: Dict[str, int] = {}
    count_result = await db.execute(
        select(Employee.department_id, func.count(Employee.id))
        .where(Employee.is_active == True)
        .group_by(Employee.department_id)
    )
    for dept_id, cnt in count_result:
        emp_counts[str(dept_id)] = cnt

    head_ids = [d.head_id for d in departments if d.head_id]
    head_map: Dict[str, DepartmentHead] = {}
    if head_ids:
        head_result = await db.execute(
            select(Employee.id, Employee.full_name, Employee.employee_code)
            .where(Employee.id.in_(head_ids))
        )
        for hid, fname, ecode in head_result:
            head_map[str(hid)] = DepartmentHead(id=str(hid), full_name=fname, employee_code=ecode)

    return [
        DepartmentResponse(
            id=str(d.id),
            name=d.name,
            code=d.code,
            description=d.description,
            is_active=d.is_active,
            head_id=str(d.head_id) if d.head_id else None,
            head=head_map.get(str(d.head_id)) if d.head_id else None,
            employee_count=emp_counts.get(str(d.id), 0),
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in departments
    ]


@router.get("/{dept_id}", response_model=DepartmentResponse)
async def get_department(
    dept_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        dept_uuid = UUID(dept_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy phòng ban")
    result = await db.execute(select(Department).where(Department.id == dept_uuid))
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError(detail="Không tìm thấy phòng ban")

    emp_count_result = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.department_id == dept_uuid, Employee.is_active == True)
    )
    emp_count = emp_count_result.scalar() or 0

    return await _build_response(db, dept, emp_count)


@router.post("", response_model=DepartmentResponse, status_code=201)
async def create_department(
    body: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_departments')),
):
    existing = await db.execute(select(Department).where(Department.code == body.code))
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Mã phòng ban đã tồn tại")

    if body.head_id:
        await _validate_head(db, body.head_id)

    dept = Department(**body.model_dump())
    db.add(dept)
    await db.flush()
    await db.refresh(dept)

    await create_audit_log(
        db, action="department.create", resource_type="department",
        resource_id=str(dept.id), user_id=str(current_user.id),
        new_values={"name": dept.name, "code": dept.code, "head_id": str(dept.head_id) if dept.head_id else None},
        success=True,
    )

    return await _build_response(db, dept, 0)


@router.put("/{dept_id}", response_model=DepartmentResponse)
async def update_department(
    dept_id: str,
    body: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_departments')),
):
    try:
        dept_uuid = UUID(dept_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy phòng ban")
    result = await db.execute(select(Department).where(Department.id == dept_uuid))
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError(detail="Không tìm thấy phòng ban")

    update_data = body.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != dept.code:
        existing = await db.execute(select(Department).where(Department.code == update_data["code"]))
        if existing.scalar_one_or_none():
            raise ConflictError(detail="Mã phòng ban đã tồn tại")

    if "head_id" in update_data:
        await _validate_head(db, update_data["head_id"])

    old_values = {k: getattr(dept, k, None) for k in update_data.keys()}
    new_values = {}
    for key, value in update_data.items():
        if key == "head_id":
            new_values["head_id"] = str(value) if value else None
            old_values["head_id"] = str(old_values["head_id"]) if old_values["head_id"] else None
        setattr(dept, key, value)

    emp_count_result = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.department_id == dept_uuid, Employee.is_active == True)
    )
    emp_count = emp_count_result.scalar() or 0

    await create_audit_log(
        db, action="department.update", resource_type="department",
        resource_id=str(dept.id), user_id=str(current_user.id),
        old_values=old_values, new_values=new_values, success=True,
    )
    await db.flush()
    await db.refresh(dept)

    return await _build_response(db, dept, emp_count)


@router.delete("/{dept_id}")
async def delete_department(
    dept_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_departments')),
):
    try:
        dept_uuid = UUID(dept_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy phòng ban")
    result = await db.execute(select(Department).where(Department.id == dept_uuid))
    dept = result.scalar_one_or_none()
    if not dept:
        raise NotFoundError(detail="Không tìm thấy phòng ban")

    emp_count = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.department_id == dept_uuid, Employee.is_active == True)
    )
    if emp_count.scalar() > 0:
        raise BadRequestError(detail="Không thể xoá phòng ban đang có nhân viên")

    dept_name = dept.name
    await db.delete(dept)
    await create_audit_log(
        db, action="department.delete", resource_type="department",
        resource_id=dept_id, user_id=str(current_user.id),
        old_values={"name": dept_name}, success=True,
    )
    await db.flush()
    return {"message": "Đã xoá phòng ban"}
