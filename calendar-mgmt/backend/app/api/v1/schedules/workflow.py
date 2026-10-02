from uuid import UUID
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission, check_scope_for_employee
from app.core.constants import RESPONSE_MESSAGES
from app.core.exceptions import ForbiddenError
from app.services import approval_service

router = APIRouter()


class BulkActionRequest(BaseModel):
    schedule_ids: list[str]


class BulkRejectRequest(BulkActionRequest):
    reason: str


@router.post("/{schedule_id}/submit")
async def submit_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_create_schedule')),
):
    from app.models.schedule import Schedule
    from sqlalchemy import select
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    auth_token = current_user.get("_token", "")
    if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    schedule = await approval_service.submit_for_approval(db, UUID(schedule_id), current_user)
    from app.api.v1.schedules.crud import _schedule_to_response
    from app.clients.hr_client import hr_client
    from app.models.shift_template import ShiftTemplate
    auth_token = current_user.get("_token", "")
    emp = await hr_client.get_employee(str(schedule.employee_id), token=auth_token)
    shift = await db.get(ShiftTemplate, schedule.shift_template_id)
    return _schedule_to_response(
        schedule, emp=emp, shift={"name": shift.name, "color": shift.color} if shift else None
    )


@router.post("/{schedule_id}/approve")
async def approve_schedule(
    schedule_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_schedule')),
):
    from app.models.schedule import Schedule
    from sqlalchemy import select
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    auth_token = current_user.get("_token", "")
    if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    schedule = await approval_service.approve_schedule(db, UUID(schedule_id), current_user)
    from app.api.v1.schedules.crud import _schedule_to_response
    from app.clients.hr_client import hr_client
    from app.models.shift_template import ShiftTemplate
    auth_token = current_user.get("_token", "")
    emp = await hr_client.get_employee(str(schedule.employee_id), token=auth_token)
    shift = await db.get(ShiftTemplate, schedule.shift_template_id)
    return _schedule_to_response(
        schedule, emp=emp, shift={"name": shift.name, "color": shift.color} if shift else None
    )


@router.post("/{schedule_id}/reject")
async def reject_schedule(
    schedule_id: str,
    reason: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_schedule')),
):
    from app.models.schedule import Schedule
    from sqlalchemy import select
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    s = result.scalar_one_or_none()
    if not s:
        raise ForbiddenError(detail=RESPONSE_MESSAGES["SCHEDULE_NOT_FOUND"])
    auth_token = current_user.get("_token", "")
    if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
        raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    schedule = await approval_service.reject_schedule(db, UUID(schedule_id), reason, current_user)
    from app.api.v1.schedules.crud import _schedule_to_response
    from app.clients.hr_client import hr_client
    from app.models.shift_template import ShiftTemplate
    auth_token = current_user.get("_token", "")
    emp = await hr_client.get_employee(str(schedule.employee_id), token=auth_token)
    shift = await db.get(ShiftTemplate, schedule.shift_template_id)
    return _schedule_to_response(
        schedule, emp=emp, shift={"name": shift.name, "color": shift.color} if shift else None
    )


@router.post("/bulk-approve")
async def bulk_approve_schedules(
    body: BulkActionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_schedule')),
):
    from app.models.schedule import Schedule
    from sqlalchemy import select
    auth_token = current_user.get("_token", "")
    result = await db.execute(select(Schedule).where(Schedule.id.in_([UUID(sid) for sid in body.schedule_ids])))
    for s in result.scalars().all():
        if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    ids = [UUID(sid) for sid in body.schedule_ids]
    approved, errors = await approval_service.bulk_approve_schedules(db, ids, current_user)
    await db.commit()
    return {
        "approved": [str(s.id) for s in approved],
        "errors": errors,
        "total": len(body.schedule_ids),
        "success_count": len(approved),
        "error_count": len(errors),
    }


@router.post("/bulk-reject")
async def bulk_reject_schedules(
    body: BulkRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_schedule')),
):
    from app.models.schedule import Schedule
    from sqlalchemy import select
    auth_token = current_user.get("_token", "")
    result = await db.execute(select(Schedule).where(Schedule.id.in_([UUID(sid) for sid in body.schedule_ids])))
    for s in result.scalars().all():
        if not await check_scope_for_employee(perms, current_user, str(s.employee_id), auth_token):
            raise ForbiddenError(detail=RESPONSE_MESSAGES["FORBIDDEN"])
    ids = [UUID(sid) for sid in body.schedule_ids]
    rejected, errors = await approval_service.bulk_reject_schedules(db, ids, body.reason, current_user)
    await db.commit()
    return {
        "rejected": [str(s.id) for s in rejected],
        "errors": errors,
        "total": len(body.schedule_ids),
        "success_count": len(rejected),
        "error_count": len(errors),
    }
