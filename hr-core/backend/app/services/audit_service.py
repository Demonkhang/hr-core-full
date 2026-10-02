import logging
import uuid
from typing import Optional
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def get_user_agent(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    return str(request.headers.get("user-agent", ""))[:255]


async def create_audit_log(
    db: AsyncSession,
    *,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[str] = None,
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    success: bool = True,
) -> AuditLog:
    if ip_address is None:
        ip_address = get_client_ip(request)
    if user_agent is None:
        user_agent = get_user_agent(request)
    if user_id is None and request is not None:
        if hasattr(request.state, "user_id"):
            user_id = request.state.user_id

    rid = uuid.UUID(resource_id) if resource_id and _is_valid_uuid(resource_id) else resource_id

    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=rid,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
    )
    db.add(log_entry)
    return log_entry


def _is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False
