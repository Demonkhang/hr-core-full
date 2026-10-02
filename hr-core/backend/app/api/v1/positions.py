from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.exceptions import NotFoundError, BadRequestError, ConflictError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.schemas.position import PositionCreate, PositionUpdate, PositionResponse
from app.models.user import User
from app.models.position import Position
from app.models.employee import Employee
from app.services.audit_service import create_audit_log

router = APIRouter()


@router.get("", response_model=list[PositionResponse])
async def list_positions(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Position)
    if active_only:
        query = query.where(Position.is_active == True)
    query = query.order_by(Position.name)
    result = await db.execute(query)
    positions = result.scalars().all()

    emp_counts = {}
    count_result = await db.execute(
        select(Employee.position_id, func.count(Employee.id))
        .where(Employee.is_active == True, Employee.position_id.isnot(None))
        .group_by(Employee.position_id)
    )
    for pos_id, cnt in count_result:
        emp_counts[str(pos_id)] = cnt

    return [
        PositionResponse(
            id=str(p.id),
            name=p.name,
            code=p.code,
            description=p.description,
            scope=p.scope,
            can_manage_employees=p.can_manage_employees,
            can_manage_departments=p.can_manage_departments,
            can_manage_workplaces=p.can_manage_workplaces,
            can_manage_settings=p.can_manage_settings,
            can_manage_users=p.can_manage_users,
            can_view_reports=p.can_view_reports,
            is_active=p.is_active,
            employee_count=emp_counts.get(str(p.id), 0),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in positions
    ]


@router.get("/{pos_id}", response_model=PositionResponse)
async def get_position(
    pos_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        pos_uuid = UUID(pos_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy chức vụ")
    result = await db.execute(select(Position).where(Position.id == pos_uuid))
    pos = result.scalar_one_or_none()
    if not pos:
        raise NotFoundError(detail="Không tìm thấy chức vụ")

    emp_count_result = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.position_id == pos_uuid, Employee.is_active == True)
    )
    emp_count = emp_count_result.scalar() or 0

    return PositionResponse(
        id=str(pos.id),
        name=pos.name,
        code=pos.code,
        description=pos.description,
        scope=pos.scope,
        can_manage_employees=pos.can_manage_employees,
        can_manage_departments=pos.can_manage_departments,
        can_manage_workplaces=pos.can_manage_workplaces,
        can_manage_settings=pos.can_manage_settings,
        can_manage_users=pos.can_manage_users,
        can_view_reports=pos.can_view_reports,
        is_active=pos.is_active,
        employee_count=emp_count,
        created_at=pos.created_at,
        updated_at=pos.updated_at,
    )


@router.post("", response_model=PositionResponse, status_code=201)
async def create_position(
    body: PositionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_settings')),
):
    existing = await db.execute(select(Position).where(Position.code == body.code))
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Mã chức vụ đã tồn tại")

    pos = Position(**body.model_dump())
    db.add(pos)
    await db.flush()
    await create_audit_log(
        db, action="position.create", resource_type="position",
        resource_id=str(pos.id), user_id=str(current_user.id),
        new_values={"name": pos.name, "code": pos.code}, success=True,
    )
    await db.commit()

    return PositionResponse(
        id=str(pos.id),
        name=pos.name,
        code=pos.code,
        description=pos.description,
        scope=pos.scope,
        can_manage_employees=pos.can_manage_employees,
        can_manage_departments=pos.can_manage_departments,
        can_manage_workplaces=pos.can_manage_workplaces,
        can_manage_settings=pos.can_manage_settings,
        can_manage_users=pos.can_manage_users,
        can_view_reports=pos.can_view_reports,
        is_active=pos.is_active,
        employee_count=0,
        created_at=pos.created_at,
        updated_at=pos.updated_at,
    )


@router.put("/{pos_id}", response_model=PositionResponse)
async def update_position(
    pos_id: str,
    body: PositionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_settings')),
):
    try:
        pos_uuid = UUID(pos_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy chức vụ")
    result = await db.execute(select(Position).where(Position.id == pos_uuid))
    pos = result.scalar_one_or_none()
    if not pos:
        raise NotFoundError(detail="Không tìm thấy chức vụ")

    update_data = body.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != pos.code:
        existing = await db.execute(select(Position).where(Position.code == update_data["code"]))
        if existing.scalar_one_or_none():
            raise ConflictError(detail="Mã chức vụ đã tồn tại")

    old_values = {k: getattr(pos, k, None) for k in update_data.keys()}
    for key, value in update_data.items():
        setattr(pos, key, value)

    pos_id_str = str(pos.id)
    pos_name = pos.name
    pos_code = pos.code
    pos_desc = pos.description
    pos_scope = pos.scope
    pos_can_manage_employees = pos.can_manage_employees
    pos_can_manage_departments = pos.can_manage_departments
    pos_can_manage_workplaces = pos.can_manage_workplaces
    pos_can_manage_settings = pos.can_manage_settings
    pos_can_manage_users = pos.can_manage_users
    pos_can_view_reports = pos.can_view_reports
    pos_active = pos.is_active
    pos_created = pos.created_at
    pos_updated = pos.updated_at

    emp_count_result = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.position_id == pos_uuid, Employee.is_active == True)
    )
    emp_count = emp_count_result.scalar() or 0

    await create_audit_log(
        db, action="position.update", resource_type="position",
        resource_id=pos_id_str, user_id=str(current_user.id),
        old_values=old_values, new_values=update_data, success=True,
    )
    await db.commit()

    return PositionResponse(
        id=pos_id_str,
        name=pos_name,
        code=pos_code,
        description=pos_desc,
        scope=pos_scope,
        can_manage_employees=pos_can_manage_employees,
        can_manage_departments=pos_can_manage_departments,
        can_manage_workplaces=pos_can_manage_workplaces,
        can_manage_settings=pos_can_manage_settings,
        can_manage_users=pos_can_manage_users,
        can_view_reports=pos_can_view_reports,
        is_active=pos_active,
        employee_count=emp_count,
        created_at=pos_created,
        updated_at=pos_updated,
    )


@router.delete("/{pos_id}")
async def delete_position(
    pos_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_settings')),
):
    try:
        pos_uuid = UUID(pos_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy chức vụ")
    result = await db.execute(select(Position).where(Position.id == pos_uuid))
    pos = result.scalar_one_or_none()
    if not pos:
        raise NotFoundError(detail="Không tìm thấy chức vụ")

    emp_count = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.position_id == pos_uuid, Employee.is_active == True)
    )
    if emp_count.scalar() > 0:
        raise BadRequestError(detail="Không thể xóa chức vụ đang có nhân viên")

    pos.is_active = False
    await create_audit_log(
        db, action="position.delete", resource_type="position",
        resource_id=pos_id, user_id=str(current_user.id),
        old_values={"is_active": True}, new_values={"is_active": False}, success=True,
    )
    await db.commit()
    return {"message": "Đã vô hiệu hóa chức vụ"}
