import asyncio
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')

from app.database import async_session_factory
from app.models.overtime_registration import OvertimeRegistration, OvertimeRegistrationStatus
from app.services.overtime_service import sync_overtime_to_schedule
from sqlalchemy import select

async def main():
    async with async_session_factory() as db:
        res = await db.execute(
            select(OvertimeRegistration).where(
                OvertimeRegistration.status == OvertimeRegistrationStatus.APPROVED,
                OvertimeRegistration.is_active == True,
            )
        )
        approved_ots = res.scalars().all()
        print(f"Found {len(approved_ots)} approved overtime registrations.")
        for ot in approved_ots:
            sched = await sync_overtime_to_schedule(db, ot, approver_id=ot.approved_by_id)
            print(f"Synced OT {ot.id} on {ot.date} -> Sched: {sched.id if sched else 'None'}, status: {sched.status if sched else 'None'}")
        await db.commit()
        print("Done syncing approved overtime records.")

if __name__ == '__main__':
    asyncio.run(main())
