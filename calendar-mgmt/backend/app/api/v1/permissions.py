import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission
from app.clients.hr_client import hr_client
from app.models.calendar_permission import CalendarPermission

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me")
async def get_my_calendar_permissions(
    perms: dict = Depends(get_current_permissions),
):
    return perms


@router.get("/positions")
async def list_calendar_permissions(
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
    db: AsyncSession = Depends(get_db),
):
    is_super_admin = bool(
        current_user.get("is_super_admin", False)
        or current_user.get("role") in ("admin", "superadmin", "super_admin")
    )
    if not is_super_admin and not perms.get("can_manage_settings"):
        raise HTTPException(status_code=403, detail="Không có quyền xem ma trận phân quyền")

    token = current_user.get("_token", "")
    positions = await hr_client.list_positions(token=token)

    if not positions:
        logger.warning("HR Core returned empty positions list")

    result = await db.execute(select(CalendarPermission).where(CalendarPermission.is_active == True))
    cal_perms = {str(cp.position_id): cp for cp in result.scalars().all()}

    enriched = []
    for pos in positions:
        pos_id = pos.get("id")
        cal_perm = cal_perms.get(pos_id)
        enriched.append({
            "id": pos_id,
            "name": pos.get("name"),
            "code": pos.get("code"),
            "scope": pos.get("scope"),
            "employee_count": pos.get("employee_count", 0),
            "can_read_schedule": cal_perm.can_read_schedule if cal_perm else True,
            "can_create_schedule": cal_perm.can_create_schedule if cal_perm else False,
            "can_update_schedule": cal_perm.can_update_schedule if cal_perm else False,
            "can_delete_schedule": cal_perm.can_delete_schedule if cal_perm else False,
            "can_approve_schedule": cal_perm.can_approve_schedule if cal_perm else False,
            "can_manage_leave": cal_perm.can_manage_leave if cal_perm else False,
            "can_approve_leave": cal_perm.can_approve_leave if cal_perm else False,
            "can_manage_overtime": cal_perm.can_manage_overtime if cal_perm else False,
            "can_approve_overtime": cal_perm.can_approve_overtime if cal_perm else False,
            "can_manage_meetings": cal_perm.can_manage_meetings if cal_perm else False,
            "can_approve_meetings": cal_perm.can_approve_meetings if cal_perm else False,
            "is_active": pos.get("is_active", True),
        })

    return enriched


@router.put("/positions/{pos_id}")
async def update_calendar_permission(
    pos_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    is_super_admin = bool(
        current_user.get("is_super_admin", False)
        or current_user.get("role") in ("admin", "superadmin", "super_admin")
    )
    if not is_super_admin:
        raise HTTPException(status_code=403, detail="Chỉ Quản trị viên tối cao mới có quyền điều chỉnh phân quyền")

    token = current_user.get("_token", "")
    positions = await hr_client.list_positions(token=token)
    pos = next((p for p in positions if p.get("id") == pos_id), None)
    if not pos:
        raise HTTPException(status_code=404, detail="Không tìm thấy chức vụ")

    result = await db.execute(
        select(CalendarPermission).where(CalendarPermission.position_id == pos_id)
    )
    cal_perm = result.scalar_one_or_none()

    if cal_perm:
        for key in ["can_read_schedule", "can_create_schedule", "can_update_schedule",
                     "can_delete_schedule", "can_approve_schedule", "can_manage_leave",
                     "can_approve_leave", "can_manage_overtime", "can_approve_overtime",
                     "can_manage_meetings", "can_approve_meetings"]:
            if key in body:
                setattr(cal_perm, key, body[key])
    else:
        cal_perm = CalendarPermission(
            position_id=pos_id,
            position_name=pos.get("name", ""),
            position_code=pos.get("code", ""),
            can_read_schedule=body.get("can_read_schedule", True),
            can_create_schedule=body.get("can_create_schedule", False),
            can_update_schedule=body.get("can_update_schedule", False),
            can_delete_schedule=body.get("can_delete_schedule", False),
            can_approve_schedule=body.get("can_approve_schedule", False),
            can_manage_leave=body.get("can_manage_leave", False),
            can_approve_leave=body.get("can_approve_leave", False),
            can_manage_overtime=body.get("can_manage_overtime", False),
            can_approve_overtime=body.get("can_approve_overtime", False),
            can_manage_meetings=body.get("can_manage_meetings", False),
            can_approve_meetings=body.get("can_approve_meetings", False),
        )
        db.add(cal_perm)

    await db.commit()
    await db.refresh(cal_perm)

    return {
        "id": str(cal_perm.position_id),
        "name": cal_perm.position_name,
        "code": cal_perm.position_code,
        "can_read_schedule": cal_perm.can_read_schedule,
        "can_create_schedule": cal_perm.can_create_schedule,
        "can_update_schedule": cal_perm.can_update_schedule,
        "can_delete_schedule": cal_perm.can_delete_schedule,
        "can_approve_schedule": cal_perm.can_approve_schedule,
        "can_manage_leave": cal_perm.can_manage_leave,
        "can_approve_leave": cal_perm.can_approve_leave,
        "can_manage_overtime": cal_perm.can_manage_overtime,
        "can_approve_overtime": cal_perm.can_approve_overtime,
        "can_manage_meetings": cal_perm.can_manage_meetings,
        "can_approve_meetings": cal_perm.can_approve_meetings,
    }
