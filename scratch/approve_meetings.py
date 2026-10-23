import asyncio
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, 'd:/luu chu khang/phanmemquanlinhansu/hr-core/calendar-mgmt/backend')
from app.database import async_session_factory
from app.models.meeting_schedule import MeetingSchedule, MeetingStatus
from sqlalchemy import select

async def main():
    async with async_session_factory() as db:
        res = await db.execute(select(MeetingSchedule).order_by(MeetingSchedule.created_at.desc()).limit(10))
        meetings = res.scalars().all()
        for x in meetings:
            print(f'Meeting: id={x.id}, title={x.title}, status={x.status}, date={x.date}, time={x.start_time}')
            if x.status == MeetingStatus.PENDING:
                x.status = MeetingStatus.APPROVED
                print(f'  -> Auto-approved meeting: {x.title}')
        await db.commit()

if __name__ == '__main__':
    asyncio.run(main())
