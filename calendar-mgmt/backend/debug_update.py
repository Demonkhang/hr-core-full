import sys
sys.path.insert(0, '/app')
import asyncio
import httpx
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.models.leave_registration import LeaveRegistration, LeaveRegistrationStatus, LeaveType
from app.services.leave_service import LeaveService
from app.schemas.leave_registration import LeaveRegistrationUpdate
from app.clients.hr_client import hr_client

from app.config import settings

async def debug():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = async_sessionmaker(engine, class_=AsyncSession)
    
    async with async_session() as db:
        result = await db.execute(
            select(LeaveRegistration).where(LeaveRegistration.status == LeaveRegistrationStatus.PENDING).limit(1)
        )
        reg = result.scalar_one_or_none()
        if not reg:
            print('No pending registration found, creating one via API...')
            async with httpx.AsyncClient() as c:
                r = await c.post('http://hr-backend:8000/api/v1/auth/login',
                    json={'username': 'admin', 'password': 'Admin@123'})
                token = r.json()['access_token']
                r = await c.post('http://localhost:8000/api/v1/leave-registrations',
                    json={'employee_id': 'cdfc761a-2114-4a94-aaaa-0e46b010a4a8',
                          'leave_type': 'annual', 'start_date': '2026-06-22',
                          'end_date': '2026-06-22', 'start_session': 'full',
                          'end_session': 'full', 'reason': 'debug test'},
                    headers={'Authorization': f'Bearer {token}'})
                reg_data = r.json()
                print(f'Created reg_id={reg_data["id"]}')
            result = await db.execute(
                select(LeaveRegistration).where(LeaveRegistration.id == reg_data['id'])
            )
            reg = result.scalar_one()
        
        print(f'Reg: id={reg.id} status={reg.status} leave_type={reg.leave_type}')
        print(f'start_date={reg.start_date} end_date={reg.end_date}')
        print(f'start_session={reg.start_session!r} end_session={reg.end_session!r}')
        print(f'total_days={reg.total_days} reason={reg.reason}')
        
        try:
            body = LeaveRegistrationUpdate(reason='debug reason test')
            update_data = body.model_dump(exclude_unset=True)
            print(f'update_data={update_data}')
            for key, value in update_data.items():
                setattr(reg, key, value)
            print(f'After setattr: reason={reg.reason}')
            
            total_days = LeaveService.calculate_total_days(
                reg.start_date, reg.end_date, reg.start_session, reg.end_session
            )
            print(f'total_days={total_days}')
            reg.total_days = total_days
            
            if reg.leave_type == LeaveType.ANNUAL:
                balance = await LeaveService.get_or_create_balance(db, reg.employee_id, reg.start_date.year)
                print(f'balance remaining={balance.remaining}')
            
            await db.commit()
            await db.refresh(reg)
            print('Commit OK')
            
            emp = await hr_client.get_employees_batch([str(reg.employee_id)])
            print(f'emp fetched: {emp.get(str(reg.employee_id)) is not None}')
            print('ALL STEPS SUCCEEDED')
        except Exception as e:
            import traceback
            print(f'ERROR: {type(e).__name__}: {e}')
            traceback.print_exc()

asyncio.run(debug())
