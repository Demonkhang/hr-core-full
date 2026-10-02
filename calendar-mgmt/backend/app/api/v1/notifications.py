from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.services import notification_service

router = APIRouter()


def _to_response(n) -> NotificationResponse:
    return NotificationResponse(
        id=str(n.id),
        employee_id=str(n.employee_id),
        schedule_id=str(n.schedule_id) if n.schedule_id else None,
        title=n.title,
        message=n.message,
        type=n.type,
        is_read=n.is_read,
        created_at=n.created_at,
    )


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    emp_id = current_user.get("employee_id")
    if not emp_id:
        return []
    notifs = await notification_service.get_unread_notifications(db, emp_id)
    return [_to_response(n) for n in notifs]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    emp_id = current_user.get("employee_id")
    if not emp_id:
        return UnreadCountResponse(count=0)
    count = await notification_service.get_unread_count(db, emp_id)
    return UnreadCountResponse(count=count)


@router.put("/{notification_id}/read", response_model=dict)
async def mark_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    emp_id = current_user.get("employee_id")
    if emp_id:
        await notification_service.mark_as_read(db, notification_id, emp_id)
    return {"ok": True}


@router.put("/read-all", response_model=dict)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    emp_id = current_user.get("employee_id")
    if emp_id:
        await notification_service.mark_all_as_read(db, emp_id)
    return {"ok": True}
