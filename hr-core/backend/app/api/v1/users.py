from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission, get_current_permissions
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.models.user import User
from app.services.user_service import create_user
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.core.security import hash_password, validate_password_strength
from app.services.audit_service import create_audit_log

router = APIRouter()


@router.get("", response_model=list[UserResponse])
async def list_users(
    active_only: bool = Query(True, description="Lọc theo is_active=True (mặc định để tránh rò rỉ)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_users')),
):
    query = select(User)
    if active_only:
        query = query.where(User.is_active == True)
    result = await db.execute(query)
    users = result.scalars().all()
    return [
        UserResponse(
            id=str(u.id),
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            is_super_admin=u.is_super_admin,
            employee_id=str(u.employee_id) if u.employee_id else None,
            department_id=str(u.department_id) if u.department_id else None,
            is_active=u.is_active,
            last_login=u.last_login,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.post("", response_model=UserResponse)
async def create_user_endpoint(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_users')),
):
    user = await create_user(
        db,
        username=body.username,
        email=body.email,
        password=body.password,
        full_name=body.full_name,
        is_super_admin=body.is_super_admin,
        employee_id=body.employee_id,
        department_id=body.department_id,
    )
    await create_audit_log(
        db, action="user.create", resource_type="user",
        resource_id=str(user.id), user_id=str(current_user.id),
        new_values={"username": user.username, "full_name": user.full_name}, success=True,
    )
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_super_admin=user.is_super_admin,
        employee_id=str(user.employee_id) if user.employee_id else None,
        department_id=str(user.department_id) if user.department_id else None,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    new_password: str = Body(..., embed=True, min_length=8),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_users')),
):
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy người dùng")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(detail="Không tìm thấy người dùng")
    validate_password_strength(new_password)
    user.hashed_password = hash_password(new_password)
    user.must_change_password = True
    await create_audit_log(
        db, action="user.reset_password", resource_type="user",
        resource_id=user_id, user_id=str(current_user.id),
        new_values={"username": user.username}, success=True,
    )
    await db.commit()
    return {"message": "Đặt lại mật khẩu thành công"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy người dùng")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(detail="Không tìm thấy người dùng")
    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_super_admin=user.is_super_admin,
        employee_id=str(user.employee_id) if user.employee_id else None,
        department_id=str(user.department_id) if user.department_id else None,
        is_active=user.is_active,
        last_login=user.last_login,
        created_at=user.created_at,
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_users')),
):
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy người dùng")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError(detail="Không tìm thấy người dùng")

    is_self = str(user.id) == str(current_user.id)
    if is_self:
        if body.is_super_admin is False and user.is_super_admin:
            raise ForbiddenError(detail="Không thể tự hạ quyền super admin của chính mình")
        if body.is_active is False and user.is_active:
            raise ForbiddenError(detail="Không thể tự vô hiệu hoá tài khoản đang đăng nhập")

    if body.password:
        validate_password_strength(body.password)
        user.hashed_password = hash_password(body.password)
        user.must_change_password = True
    update_data = body.model_dump(exclude_unset=True, exclude={'password'})
    old_values = {k: getattr(user, k, None) for k in update_data.keys()}
    for key, value in update_data.items():
        setattr(user, key, value)

    await create_audit_log(
        db, action="user.update", resource_type="user",
        resource_id=user_id, user_id=str(current_user.id),
        old_values=old_values, new_values=update_data, success=True,
    )
    await db.commit()

    return UserResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_super_admin=user.is_super_admin,
        employee_id=str(user.employee_id) if user.employee_id else None,
        department_id=str(user.department_id) if user.department_id else None,
        is_active=user.is_active,
        last_login=user.last_login,
        created_at=user.created_at,
    )
