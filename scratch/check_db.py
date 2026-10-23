import asyncio
import os
import sys

# Ensure UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')

from app.database import async_session_factory
from app.models.shift_template import ShiftTemplate
from app.models.schedule import Schedule
from app.models.overtime_registration import OvertimeRegistration
from sqlalchemy import select

async def main():
    async with async_session_factory() as db:
        res = await db.execute(select(ShiftTemplate))
        sts = res.scalars().all()
        print('=== Shift templates:', len(sts))
        for st in sts:
            print(f'  ST: id={st.id}, wp_id={st.workplace_id}, name={st.name}, start={st.start_time}, end={st.end_time}, is_active={st.is_active}')
        
        res = await db.execute(select(OvertimeRegistration))
        ots = res.scalars().all()
        print('=== Overtime registrations:', len(ots))
        for ot in ots:
            print(f'  OT: id={ot.id}, emp_id={ot.employee_id}, date={ot.date}, start={ot.start_time}, end={ot.end_time}, hours={ot.total_hours}, status={ot.status}')

        res = await db.execute(select(Schedule))
        scs = res.scalars().all()
        print('=== Schedules:', len(scs))
        for sc in scs:
            print(f'  SC: id={sc.id}, emp_id={sc.employee_id}, date={sc.date}, shift_id={sc.shift_template_id}, wp_id={sc.workplace_id}, status={sc.status}, is_ot={sc.is_overtime}')

if __name__ == '__main__':
    asyncio.run(main())
