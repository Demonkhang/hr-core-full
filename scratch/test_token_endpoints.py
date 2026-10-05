import asyncio
from dotenv import load_dotenv
load_dotenv("hr-core/backend/.env")

from app.database import async_session_factory
from sqlalchemy import text
from app.core.security import create_access_token
import httpx

async def test_both():
    async with async_session_factory() as session:
        res = await session.execute(text("SELECT id FROM users LIMIT 1"))
        user_row = res.fetchone()
        user_id = str(user_row[0]) if user_row else "00000000-0000-0000-0000-000000000001"

    token = create_access_token(user_id=user_id)
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient() as client:
        r1 = await client.get("http://localhost:8001/api/v1/base-salary-config", headers=headers)
        print("Base salary status:", r1.status_code)
        
        r2 = await client.get("http://localhost:8001/api/v1/shift-rate-configs", headers=headers)
        print("Shift rates status:", r2.status_code)
        if r2.status_code != 200:
            print("Shift rates error detail:", r2.text)
        else:
            print("Shift rates count:", len(r2.json()))

if __name__ == "__main__":
    asyncio.run(test_both())

