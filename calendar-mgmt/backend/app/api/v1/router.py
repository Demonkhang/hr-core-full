from fastapi import APIRouter
from app.api.v1.shift_templates import router as shift_templates_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.reports import router as reports_router
from app.api.v1.overtime_registrations import router as overtime_registrations_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.leave_balances import router as leave_balances_router
from app.api.v1.leave_registrations import router as leave_registrations_router
from app.api.v1.meeting_schedules import router as meeting_schedules_router
from app.api.v1.proxy import router as proxy_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.permissions import router as permissions_router


api_router = APIRouter(prefix="/api/v1")

api_router.include_router(shift_templates_router, prefix="/shift-templates", tags=["Shift Templates"])
api_router.include_router(schedules_router, tags=["Schedules"])
api_router.include_router(reports_router, prefix="/reports", tags=["Reports"])
api_router.include_router(overtime_registrations_router, prefix="/overtime-registrations", tags=["Overtime Registrations"])
api_router.include_router(dashboard_router, prefix="/reports", tags=["Dashboard"])
api_router.include_router(leave_balances_router, prefix="/leave-balances", tags=["Leave Balances"])
api_router.include_router(leave_registrations_router, prefix="/leave-registrations", tags=["Leave Registrations"])
api_router.include_router(meeting_schedules_router, prefix="/meeting-schedules", tags=["Meeting Schedules"])
api_router.include_router(proxy_router, prefix="/hr", tags=["HR Proxy"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(permissions_router, prefix="/permissions", tags=["Permissions"])
