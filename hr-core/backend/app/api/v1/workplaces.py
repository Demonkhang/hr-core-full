from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.exceptions import NotFoundError, ConflictError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission, get_current_permissions
from app.schemas.workplace import WorkplaceCreate, WorkplaceUpdate, WorkplaceResponse
from app.models.user import User
from app.models.workplace import Workplace
from app.services.audit_service import create_audit_log

router = APIRouter()


@router.get("", response_model=list[WorkplaceResponse])
async def list_workplaces(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Workplace)
    if active_only:
        query = query.where(Workplace.is_active == True)
    query = query.order_by(Workplace.name)

    result = await db.execute(query)
    workplaces = result.scalars().all()
    return [
        WorkplaceResponse(
            id=str(w.id),
            name=w.name,
            code=w.code,
            address=w.address,
            is_office_hours=w.is_office_hours,
            is_active=w.is_active,
            created_at=w.created_at,
            updated_at=w.updated_at,
        )
        for w in workplaces
    ]


@router.get("/{wp_id}", response_model=WorkplaceResponse)
async def get_workplace(
    wp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        wp_uuid = UUID(wp_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy nơi làm việc")
    result = await db.execute(select(Workplace).where(Workplace.id == wp_uuid))
    w = result.scalar_one_or_none()
    if not w:
        raise NotFoundError(detail="Không tìm thấy nơi làm việc")
    return WorkplaceResponse(
        id=str(w.id),
        name=w.name,
        code=w.code,
        address=w.address,
        is_office_hours=w.is_office_hours,
        is_active=w.is_active,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.post("", response_model=WorkplaceResponse, status_code=201)
async def create_workplace(
    body: WorkplaceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_workplaces')),
):
    if body.code:
        existing = await db.execute(select(Workplace).where(Workplace.code == body.code))
        if existing.scalar_one_or_none():
            raise ConflictError(detail="Mã nơi làm việc đã tồn tại")

    wp = Workplace(**body.model_dump())
    db.add(wp)
    await create_audit_log(
        db, action="workplace.create", resource_type="workplace",
        resource_id=str(wp.id), user_id=str(current_user.id),
        new_values={"name": wp.name, "code": wp.code}, success=True,
    )
    await db.commit()

    return WorkplaceResponse(
        id=str(wp.id),
        name=wp.name,
        code=wp.code,
        address=wp.address,
        is_office_hours=wp.is_office_hours,
        is_active=wp.is_active,
        created_at=wp.created_at,
        updated_at=wp.updated_at,
    )


@router.put("/{wp_id}", response_model=WorkplaceResponse)
async def update_workplace(
    wp_id: str,
    body: WorkplaceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_workplaces')),
):
    try:
        wp_uuid = UUID(wp_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy nơi làm việc")
    result = await db.execute(select(Workplace).where(Workplace.id == wp_uuid))
    w = result.scalar_one_or_none()
    if not w:
        raise NotFoundError(detail="Không tìm thấy nơi làm việc")

    update_data = body.model_dump(exclude_unset=True)
    old_values = {k: getattr(w, k, None) for k in update_data.keys()}
    for key, value in update_data.items():
        setattr(w, key, value)

    wp_id_str = str(w.id)
    wp_name = w.name
    wp_code = w.code
    wp_addr = w.address
    wp_office = w.is_office_hours
    wp_active = w.is_active
    wp_created = w.created_at
    wp_updated = w.updated_at

    await create_audit_log(
        db, action="workplace.update", resource_type="workplace",
        resource_id=wp_id_str, user_id=str(current_user.id),
        old_values=old_values, new_values=update_data, success=True,
    )
    await db.commit()

    return WorkplaceResponse(
        id=wp_id_str,
        name=wp_name,
        code=wp_code,
        address=wp_addr,
        is_office_hours=wp_office,
        is_active=wp_active,
        created_at=wp_created,
        updated_at=wp_updated,
    )


@router.delete("/{wp_id}")
async def delete_workplace(
    wp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_workplaces')),
):
    try:
        wp_uuid = UUID(wp_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy nơi làm việc")
    result = await db.execute(select(Workplace).where(Workplace.id == wp_uuid))
    w = result.scalar_one_or_none()
    if not w:
        raise NotFoundError(detail="Không tìm thấy nơi làm việc")
    w.is_active = False
    await create_audit_log(
        db, action="workplace.delete", resource_type="workplace",
        resource_id=wp_id, user_id=str(current_user.id),
        old_values={"is_active": True}, new_values={"is_active": False}, success=True,
    )
    await db.commit()
    return {"message": "Đã vô hiệu hóa nơi làm việc"}
