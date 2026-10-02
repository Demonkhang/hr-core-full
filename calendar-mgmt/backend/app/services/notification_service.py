from uuid import UUID
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification


async def create_notification(
    db: AsyncSession,
    employee_id: str,
    title: str,
    message: str,
    type: str,
    schedule_id: str | None = None,
) -> Notification:
    notif = Notification(
        employee_id=UUID(employee_id),
        schedule_id=UUID(schedule_id) if schedule_id else None,
        title=title,
        message=message,
        type=type,
    )
    db.add(notif)
    await db.flush()
    return notif


async def get_unread_notifications(db: AsyncSession, employee_id: str) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.employee_id == UUID(employee_id), Notification.is_read == False)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


async def get_unread_count(db: AsyncSession, employee_id: str) -> int:
    result = await db.execute(
        select(func.count(Notification.id))
        .where(Notification.employee_id == UUID(employee_id), Notification.is_read == False)
    )
    return result.scalar() or 0


async def mark_as_read(db: AsyncSession, notification_id: str, employee_id: str) -> bool:
    result = await db.execute(
        update(Notification)
        .where(
            Notification.id == UUID(notification_id),
            Notification.employee_id == UUID(employee_id),
        )
        .values(is_read=True)
    )
    await db.flush()
    return result.rowcount > 0


async def mark_all_as_read(db: AsyncSession, employee_id: str) -> int:
    result = await db.execute(
        update(Notification)
        .where(
            Notification.employee_id == UUID(employee_id),
            Notification.is_read == False,
        )
        .values(is_read=True)
    )
    await db.flush()
    return result.rowcount
