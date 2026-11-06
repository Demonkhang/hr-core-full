import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, async_session_factory
from app.api.deps import get_current_user, get_current_permissions
from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ChangePasswordRequest, UserInfo, UserPermissions,
)
from app.services.authentication_service import authenticate_user, create_tokens, refresh_tokens, revoke_token
from app.services import user_service
from app.models.user import User
from app.models.employee import Employee
from app.models.position import Position
from app.models.personnel_profile import VcProfile
from app.core.constants import RESPONSE_MESSAGES
from app.core.exceptions import UnauthorizedError
from app.core.security import validate_password_strength
from app.config import settings
from app.core.limiter import limiter
from app.services.audit_service import create_audit_log

logger = logging.getLogger(__name__)

router = APIRouter()


async def _log_auth_failure(username: str, request: Request, reason: str = "invalid_credentials"):
    try:
        async with async_session_factory() as db:
            await create_audit_log(
                db,
                action="auth.login_failed",
                resource_type="auth",
                new_values={"username": username, "reason": reason},
                request=request,
                success=False,
            )
            await db.commit()
    except Exception as e:
        logger.warning("Failed to log auth failure: %s", e)


async def _log_auth_success(user_id: str, username: str, request: Request):
    try:
        async with async_session_factory() as db:
            await create_audit_log(
                db,
                action="auth.login_success",
                resource_type="auth",
                user_id=user_id,
                new_values={"username": username},
                request=request,
                success=True,
            )
            await db.commit()
    except Exception as e:
        logger.warning("Failed to log auth success: %s", e)


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        user = await authenticate_user(db, body.username, body.password)
    except UnauthorizedError as exc:
        reason = "account_disabled" if "vô hiệu" in exc.detail else "invalid_credentials"
        await _log_auth_failure(body.username, request, reason)
        raise
    await _log_auth_success(str(user.id), user.username, request)
    return await create_tokens(db, user, remember_me=body.remember_me)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_REFRESH)
async def refresh(request: Request, body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    return await refresh_tokens(db, body.refresh_token)


@router.post("/logout")
@limiter.limit("30/minute")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await revoke_token(db, current_user.id)
    await create_audit_log(
        db, action="auth.logout", resource_type="auth",
        user_id=str(current_user.id), new_values={"username": current_user.username},
        request=request, success=True,
    )
    return {"message": RESPONSE_MESSAGES["LOGOUT"]}


@router.get("/me", response_model=UserInfo)
async def get_me(
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
    db: AsyncSession = Depends(get_db),
):
    pos_name: str | None = None
    pos_code: str | None = None
    emp: Employee | None = None
    pos: Position | None = None

    emp_id = current_user.employee_id
    if not emp_id:
        res_prof = await db.execute(
            select(VcProfile.employee_id).where(VcProfile.user_id == current_user.id)
        )
        emp_id = res_prof.scalar_one_or_none()

    if emp_id:
        res_emp = await db.execute(select(Employee).where(Employee.id == emp_id))
        emp = res_emp.scalar_one_or_none()
        if emp and emp.position_id:
            res_pos = await db.execute(select(Position).where(Position.id == emp.position_id))
            pos = res_pos.scalar_one_or_none()

    if pos:
        pos_name = pos.name
        pos_code = pos.code
    elif emp and emp.position:
        pos_name = emp.position

    pos_name_lower = (pos_name or "").strip().lower()
    pos_code_upper = (pos_code or "").strip().upper()

    non_manager_keywords = (
        "nhân viên",
        "chuyên viên",
        "người lao động",
        "cộng tác viên",
        "thực tập",
        "tập sự",
        "văn thư",
        "thủ quỹ",
        "kế toán viên",
        "người đăng ký",
        "cán bộ",
        "viên chức",
    )
    manager_keywords = (
        "giám đốc",
        "trưởng phòng",
        "phó phòng",
        "phó trưởng phòng",
        "chánh văn phòng",
        "phó chánh",
        "trưởng ban",
        "phó ban",
        "quản lý",
        "quản trị",
    )

    if current_user.is_super_admin or current_user.username.lower() in ("admin", "manager"):
        is_mgmt = True
    elif any(k in pos_name_lower for k in non_manager_keywords) or pos_code_upper in ("NV", "CV", "CVC", "NLD", "CTV"):
        is_mgmt = False
    elif any(k in pos_name_lower for k in manager_keywords) or pos_code_upper in ("GD", "PGD", "TP", "PTP", "CVP", "PCVP"):
        is_mgmt = True
    else:
        is_mgmt = bool(perms.get("can_manage_users") or perms.get("can_manage_settings"))

    return UserInfo(
        id=str(current_user.id),
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        is_super_admin=current_user.is_super_admin,
        department_id=str(current_user.department_id) if current_user.department_id else None,
        employee_id=str(emp_id) if emp_id else None,
        position_name=pos_name,
        position_code=pos_code,
        is_management_position=is_mgmt,
        must_change_password=current_user.must_change_password,
        permissions=UserPermissions(**perms),
    )


@router.post("/change-password")
@limiter.limit("10/minute")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    validate_password_strength(body.new_password)
    if body.old_password == body.new_password:
        from app.core.exceptions import BadRequestError
        raise BadRequestError(detail="Mật khẩu mới phải khác mật khẩu cũ")
    await user_service.change_password(db, current_user, body.old_password, body.new_password)
    await create_audit_log(
        db, action="auth.change_password", resource_type="auth",
        user_id=str(current_user.id), new_values={"username": current_user.username},
        request=request, success=True,
    )
    return {"message": RESPONSE_MESSAGES["PASSWORD_CHANGED"]}
