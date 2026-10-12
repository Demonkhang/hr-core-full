from fastapi import APIRouter, Depends, Request, Query
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.clients.hr_client import hr_client


router = APIRouter()


@router.get("/employees/{employee_id}")
async def proxy_get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_employee(employee_id) or {"error": "Not found"}


@router.get("/employees/{employee_id}/detail")
async def proxy_get_employee_detail(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_employee(employee_id) or {"error": "Not found"}


@router.get("/employees")
async def proxy_list_employees(
    active_only: Optional[bool] = Query(True),
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    return await hr_client.get_employees(active_only=active_only, token=token)


@router.get("/departments")
async def proxy_list_departments(
    active_only: Optional[bool] = Query(True),
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    try:
        from httpx import AsyncClient
        async with AsyncClient(timeout=10) as client:
            from app.config import settings
            params = {"active_only": "true" if active_only else "false"}
            resp = await client.get(
                f"{settings.HR_CORE_BASE_URL}/api/v1/departments",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
            if resp.status_code == 200:
                return resp.json()
            return []
    except Exception:
        return []


@router.get("/departments/{department_id}")
async def proxy_get_department(
    department_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_department(department_id) or {"error": "Not found"}


@router.get("/workplaces")
async def proxy_list_workplaces(
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    try:
        from httpx import AsyncClient
        async with AsyncClient(timeout=10) as client:
            from app.config import settings
            resp = await client.get(
                f"{settings.HR_CORE_BASE_URL}/api/v1/workplaces",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json()
            return []
    except Exception:
        return []


@router.get("/workplaces/{workplace_id}")
async def proxy_get_workplace(
    workplace_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_workplace(workplace_id) or {"error": "Not found"}


@router.post("/internal/clear-cache")
async def internal_clear_cache(key: Optional[str] = Query(None)):
    hr_client.clear_cache(key)
    return {"status": "ok", "message": "Cache cleared successfully"}


@router.post("/internal/offboard-employee")
async def internal_offboard_employee(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    employee_id = body.get("employee_id")
    if not employee_id:
        return {"status": "error", "message": "employee_id is required"}

    from datetime import date
    from uuid import UUID
    from sqlalchemy import select
    from app.models.schedule import Schedule
    from app.models.leave_registration import LeaveRegistration, LeaveRegistrationStatus
    from app.models.overtime_registration import OvertimeRegistration, OvertimeStatus
    from app.core.constants import ScheduleStatus

    try:
        emp_uuid = UUID(employee_id)
    except ValueError:
        return {"status": "error", "message": "Invalid employee_id"}

    hr_client.clear_cache(f"emp:{employee_id}")
    today = date.today()

    # Cancel future schedules
    stmt_sched = select(Schedule).where(
        Schedule.employee_id == emp_uuid,
        Schedule.date >= today,
        Schedule.status.in_([ScheduleStatus.PENDING, ScheduleStatus.APPROVED])
    )
    res_sched = await db.execute(stmt_sched)
    schedules = res_sched.scalars().all()
    for s in schedules:
        s.status = ScheduleStatus.CANCELLED

    # Cancel pending leave registrations
    stmt_leave = select(LeaveRegistration).where(
        LeaveRegistration.employee_id == emp_uuid,
        LeaveRegistration.status == LeaveRegistrationStatus.PENDING
    )
    res_leave = await db.execute(stmt_leave)
    leaves = res_leave.scalars().all()
    for l in leaves:
        l.status = LeaveRegistrationStatus.REJECTED
        l.rejection_reason = "Nhân viên đã thôi việc (Tự động từ chối)"

    # Cancel pending overtime registrations
    stmt_ot = select(OvertimeRegistration).where(
        OvertimeRegistration.employee_id == emp_uuid,
        OvertimeRegistration.status == OvertimeStatus.PENDING
    )
    res_ot = await db.execute(stmt_ot)
    ots = res_ot.scalars().all()
    for o in ots:
        o.status = OvertimeStatus.REJECTED
        o.rejection_reason = "Nhân viên đã thôi việc (Tự động từ chối)"

    await db.commit()
    return {
        "status": "ok",
        "cancelled_schedules": len(schedules),
        "rejected_leaves": len(leaves),
        "rejected_overtimes": len(ots)
    }

