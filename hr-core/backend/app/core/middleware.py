import logging
import re
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session_factory
from app.models.audit_log import AuditLog
from app.services.audit_service import create_audit_log, get_client_ip, get_user_agent

logger = logging.getLogger(__name__)

UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


def _extract_resource_info(path: str):
    parts = [p for p in path.strip("/").split("/") if p]
    if not parts:
        return "unknown", None
    if len(parts) >= 2 and UUID_PATTERN.match(parts[-1]):
        return parts[-2], parts[-1]
    if len(parts) >= 3 and UUID_PATTERN.match(parts[-1]):
        return parts[-2], parts[-1]
    return parts[-1], None


class AuditLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and response.status_code < 400:
            try:
                await self._log_audit(request, response)
            except Exception as e:
                logger.warning(f"Lỗi ghi nhật ký kiểm tra: {e}")
        return response

    async def _log_audit(self, request: Request, response: Response):
        resource_type, resource_id = _extract_resource_info(request.url.path)

        user_id = None
        if hasattr(request.state, "user_id"):
            user_id = request.state.user_id

        async with async_session_factory() as db:
            await create_audit_log(
                db,
                action=f"{request.method.lower()}.{resource_type}",
                resource_type=resource_type,
                resource_id=resource_id,
                user_id=user_id,
                ip_address=get_client_ip(request),
                user_agent=get_user_agent(request),
                success=True,
            )
            await db.commit()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data: blob:",
            "connect-src 'self' http://localhost:3000 http://localhost:5173 ws: wss:",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)
        return response
