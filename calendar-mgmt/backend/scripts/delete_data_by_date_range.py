"""
Script xoá dữ liệu lịch trực, họp, nghỉ phép, thêm giờ theo khoảng thời gian.

Usage:
    python -m scripts.delete_data_by_date_range --from 2025-01-01 --to 2025-06-30 --type schedule
    python -m scripts.delete_data_by_date_range --from 2025-01-01 --to 2025-06-30 --type all --dry-run
    python -m scripts.delete_data_by_date_range --from 2025-01-01 --to 2025-06-30 --type schedule --status pending
"""

import argparse
import asyncio
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.config import settings
from app.models.schedule import Schedule
from app.models.schedule_change_log import ScheduleChangeLog
from app.models.meeting_schedule import MeetingSchedule
from app.models.meeting_participant import MeetingParticipant
from app.models.leave_registration import LeaveRegistration
from app.models.overtime_registration import OvertimeRegistration
from app.models.notification import Notification


VALID_TYPES = ("schedule", "meeting", "leave", "overtime", "all")


async def count_schedules(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    q = select(func.count()).select_from(Schedule).where(Schedule.date >= start, Schedule.date <= end)
    if status:
        q = q.where(Schedule.status == status)
    return (await db.execute(q)).scalar_one()


async def count_change_logs_for_schedules(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    sub = select(Schedule.id).where(Schedule.date >= start, Schedule.date <= end)
    if status:
        sub = sub.where(Schedule.status == status)
    return (await db.execute(
        select(func.count()).select_from(ScheduleChangeLog).where(ScheduleChangeLog.schedule_id.in_(sub))
    )).scalar_one()


async def count_notifications_for_schedules(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    sub = select(Schedule.id).where(Schedule.date >= start, Schedule.date <= end)
    if status:
        sub = sub.where(Schedule.status == status)
    return (await db.execute(
        select(func.count()).select_from(Notification).where(Notification.schedule_id.in_(sub))
    )).scalar_one()


async def count_meetings(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    q = select(func.count()).select_from(MeetingSchedule).where(MeetingSchedule.date >= start, MeetingSchedule.date <= end)
    if status:
        q = q.where(MeetingSchedule.status == status)
    return (await db.execute(q)).scalar_one()


async def count_participants_for_meetings(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    sub = select(MeetingSchedule.id).where(MeetingSchedule.date >= start, MeetingSchedule.date <= end)
    if status:
        sub = sub.where(MeetingSchedule.status == status)
    return (await db.execute(
        select(func.count()).select_from(MeetingParticipant).where(MeetingParticipant.meeting_id.in_(sub))
    )).scalar_one()


async def count_leaves(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    q = select(func.count()).select_from(LeaveRegistration).where(
        LeaveRegistration.start_date <= end, LeaveRegistration.end_date >= start
    )
    if status:
        q = q.where(LeaveRegistration.status == status)
    return (await db.execute(q)).scalar_one()


async def count_overtimes(db: AsyncSession, start: date, end: date, status: str | None) -> int:
    q = select(func.count()).select_from(OvertimeRegistration).where(
        OvertimeRegistration.date >= start, OvertimeRegistration.date <= end
    )
    if status:
        q = q.where(OvertimeRegistration.status == status)
    return (await db.execute(q)).scalar_one()


async def delete_schedule_data(db: AsyncSession, start: date, end: date, status: str | None) -> dict:
    schedule_q = select(Schedule.id).where(Schedule.date >= start, Schedule.date <= end)
    if status:
        schedule_q = schedule_q.where(Schedule.status == status)
    schedule_ids = (await db.execute(schedule_q)).scalars().all()

    if not schedule_ids:
        return {"change_logs": 0, "notifications": 0, "schedules": 0}

    cl_result = await db.execute(
        delete(ScheduleChangeLog).where(ScheduleChangeLog.schedule_id.in_(schedule_ids))
    )
    noti_result = await db.execute(
        delete(Notification).where(Notification.schedule_id.in_(schedule_ids))
    )
    sch_result = await db.execute(
        delete(Schedule).where(Schedule.id.in_(schedule_ids))
    )

    return {
        "schedules": sch_result.rowcount,
        "change_logs": cl_result.rowcount,
        "notifications": noti_result.rowcount,
    }


async def delete_meeting_data(db: AsyncSession, start: date, end: date, status: str | None) -> dict:
    meeting_q = select(MeetingSchedule.id).where(MeetingSchedule.date >= start, MeetingSchedule.date <= end)
    if status:
        meeting_q = meeting_q.where(MeetingSchedule.status == status)
    meeting_ids = (await db.execute(meeting_q)).scalars().all()

    if not meeting_ids:
        return {"participants": 0, "meetings": 0}

    await db.execute(
        delete(MeetingParticipant).where(MeetingParticipant.meeting_id.in_(meeting_ids))
    )
    mt_result = await db.execute(
        delete(MeetingSchedule).where(MeetingSchedule.id.in_(meeting_ids))
    )

    return {"meetings": mt_result.rowcount, "participants": len(meeting_ids)}


async def delete_leave_data(db: AsyncSession, start: date, end: date, status: str | None) -> dict:
    q = delete(LeaveRegistration).where(
        LeaveRegistration.start_date <= end, LeaveRegistration.end_date >= start
    )
    if status:
        q = q.where(LeaveRegistration.status == status)
    result = await db.execute(q)
    return {"leave_registrations": result.rowcount}


async def delete_overtime_data(db: AsyncSession, start: date, end: date, status: str | None) -> dict:
    q = delete(OvertimeRegistration).where(
        OvertimeRegistration.date >= start, OvertimeRegistration.date <= end
    )
    if status:
        q = q.where(OvertimeRegistration.status == status)
    result = await db.execute(q)
    return {"overtime_registrations": result.rowcount}


async def main():
    parser = argparse.ArgumentParser(description="Xoá dữ liệu theo khoảng thời gian")
    parser.add_argument("--from", dest="start_date", required=True, help="Ngày bắt đầu (YYYY-MM-DD)")
    parser.add_argument("--to", dest="end_date", required=True, help="Ngày kết thúc (YYYY-MM-DD)")
    parser.add_argument("--type", dest="data_type", default="all", choices=VALID_TYPES, help="Loại dữ liệu")
    parser.add_argument("--status", dest="status", default=None, help="Chỉ xoá bản ghi có status cụ thể")
    parser.add_argument("--dry-run", action="store_true", help="Chỉ preview, không xoá")
    args = parser.parse_args()

    start = date.fromisoformat(args.start_date)
    end = date.fromisoformat(args.end_date)
    data_type = args.data_type
    status = args.status
    dry_run = args.dry_run

    if start > end:
        print("Error: --from must be <= --to")
        sys.exit(1)

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        print(f"Date range: {start} -> {end}")
        if status:
            print(f"Status filter: {status}")
        print(f"Mode: {'DRY RUN' if dry_run else 'DELETE'}")
        print("-" * 50)

        counts = {}

        if data_type in ("schedule", "all"):
            counts["schedule_change_logs"] = await count_change_logs_for_schedules(db, start, end, status)
            counts["notifications"] = await count_notifications_for_schedules(db, start, end, status)
            counts["schedules"] = await count_schedules(db, start, end, status)

        if data_type in ("meeting", "all"):
            counts["meeting_participants"] = await count_participants_for_meetings(db, start, end, status)
            counts["meetings"] = await count_meetings(db, start, end, status)

        if data_type in ("leave", "all"):
            counts["leave_registrations"] = await count_leaves(db, start, end, status)

        if data_type in ("overtime", "all"):
            counts["overtime_registrations"] = await count_overtimes(db, start, end, status)

        prefix = "[DRY RUN]" if dry_run else "[COUNT]"
        for table, count in counts.items():
            print(f"  {prefix} {table}: {count} rows")

        total = sum(counts.values())
        print(f"  Total: {total} rows")
        print()

        if dry_run or total == 0:
            if total == 0:
                print("Nothing to delete.")
            else:
                print("No changes made (dry run).")
            await engine.dispose()
            return

        print("Deleting...")
        results = {}

        if data_type in ("schedule", "all"):
            r = await delete_schedule_data(db, start, end, status)
            results.update(r)

        if data_type in ("meeting", "all"):
            r = await delete_meeting_data(db, start, end, status)
            results.update(r)

        if data_type in ("leave", "all"):
            r = await delete_leave_data(db, start, end, status)
            results.update(r)

        if data_type in ("overtime", "all"):
            r = await delete_overtime_data(db, start, end, status)
            results.update(r)

        await db.commit()

        deleted_total = 0
        for table, count in results.items():
            if count > 0:
                print(f"  [OK] {table}: {count} rows deleted")
                deleted_total += count

        print(f"\nDone. Total: {deleted_total} rows deleted.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
