import logging
from datetime import datetime, date
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date, or_
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions
from app.schemas.audit_log import AuditLogResponse, AuditLogStatsResponse
from app.models.audit_log import AuditLog
from app.models.user import User
from app.core.exceptions import NotFoundError, ForbiddenError
from app.core.constants import RESPONSE_MESSAGES, SCOPE_ORGANIZATION

logger = logging.getLogger(__name__)

router = APIRouter()


async def _check_audit_access(perms: dict, current_user: User):
    if not perms.get("can_view_reports") and not current_user.is_super_admin:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])


@router.get("", response_model=list[AuditLogResponse])
async def list_audit_logs(
    action: Optional[str] = Query(None, description="Lọc theo action (keyword)"),
    actions: Optional[str] = Query(None, description="DS hành động, cách nhau bằng dấu phẩy (create,update,delete,login,logout)"),
    resource_type: Optional[str] = Query(None, description="Lọc theo resource_type"),
    resource_id: Optional[str] = Query(None, description="Lọc theo resource_id"),
    user_id: Optional[str] = Query(None, description="Lọc theo user_id"),
    success: Optional[bool] = Query(None, description="Lọc theo trạng thái thành công"),
    date_from: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0, description="Bỏ qua N bản ghi đầu"),
    limit: int = Query(50, ge=1, le=200, description="Số bản ghi tối đa (tối đa 200)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    await _check_audit_access(perms, current_user)

    query = select(AuditLog).options(selectinload(AuditLog.user))

    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if actions:
        action_list = [a.strip() for a in actions.split(",") if a.strip()]
        if action_list:
            query = query.where(or_(AuditLog.action.ilike(f"%{a}%") for a in action_list))
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if resource_id:
        try:
            rid = UUID(resource_id)
            query = query.where(AuditLog.resource_id == rid)
        except ValueError:
            query = query.where(AuditLog.resource_id.is_(None))
    if user_id:
        try:
            uid = UUID(user_id)
            query = query.where(AuditLog.user_id == uid)
        except ValueError:
            pass
    if success is not None:
        query = query.where(AuditLog.success == success)
    if date_from:
        query = query.where(cast(AuditLog.created_at, Date) >= date_from)
    if date_to:
        query = query.where(cast(AuditLog.created_at, Date) <= date_to)

    if perms.get("scope") != SCOPE_ORGANIZATION and not current_user.is_super_admin:
        query = query.where(AuditLog.user_id == current_user.id)

    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0

    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return [
        AuditLogResponse(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            username=log.user.username if log.user else None,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=str(log.resource_id) if log.resource_id else None,
            old_values=log.old_values,
            new_values=log.new_values,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            created_at=log.created_at,
            success=log.success,
        )
        for log in logs
    ]


@router.get("/stats", response_model=AuditLogStatsResponse)
async def get_audit_stats(
    date_from: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    actions: Optional[str] = Query(None, description="DS hành động, cách nhau bằng dấu phẩy"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    await _check_audit_access(perms, current_user)

    base_query = select(AuditLog)
    if date_from:
        base_query = base_query.where(cast(AuditLog.created_at, Date) >= date_from)
    if date_to:
        base_query = base_query.where(cast(AuditLog.created_at, Date) <= date_to)
    if actions:
        action_list = [a.strip() for a in actions.split(",") if a.strip()]
        if action_list:
            base_query = base_query.where(or_(AuditLog.action.ilike(f"%{a}%") for a in action_list))

    total_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar() or 0

    action_query = select(AuditLog.action, func.count().label("cnt")).group_by(AuditLog.action).order_by(func.count().desc())
    action_result = await db.execute(action_query)
    by_action = [{"action": row.action, "count": row.cnt} for row in action_result]

    resource_query = select(AuditLog.resource_type, func.count().label("cnt")).group_by(AuditLog.resource_type).order_by(func.count().desc())
    resource_result = await db.execute(resource_query)
    by_resource = [{"resource_type": row.resource_type, "count": row.cnt} for row in resource_result]

    date_query = select(cast(AuditLog.created_at, Date).label("day"), func.count().label("cnt")).group_by(cast(AuditLog.created_at, Date)).order_by(cast(AuditLog.created_at, Date).desc()).limit(30)
    date_result = await db.execute(date_query)
    by_date = [{"date": row.day.isoformat(), "count": row.cnt} for row in date_result]

    return AuditLogStatsResponse(
        total=total,
        by_action=by_action,
        by_resource=by_resource,
        by_date=by_date,
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log_detail(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    await _check_audit_access(perms, current_user)

    try:
        log_uuid = UUID(log_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy bản ghi audit")
    result = await db.execute(
        select(AuditLog).options(selectinload(AuditLog.user)).where(AuditLog.id == log_uuid)
    )
    log = result.scalar_one_or_none()
    if not log:
        raise NotFoundError(detail="Không tìm thấy bản ghi audit")

    return AuditLogResponse(
        id=str(log.id),
        user_id=str(log.user_id) if log.user_id else None,
        username=log.user.username if log.user else None,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=str(log.resource_id) if log.resource_id else None,
        old_values=log.old_values,
        new_values=log.new_values,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
        success=log.success,
    )
