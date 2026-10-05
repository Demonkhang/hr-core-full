import asyncio
from dotenv import load_dotenv
load_dotenv("hr-core/backend/.env")

from app.database import async_session_factory
from sqlalchemy import text

async def check():
    async with async_session_factory() as session:
        try:
            res = await session.execute(text("SELECT id, code, name, multiplier, allowance_amount FROM shift_rate_configs"))
            rows = res.fetchall()
            print("Shift rate rows count:", len(rows))
            for r in rows:
                print(dict(r._mapping))
        except Exception as e:
            print("DB Error:", e)

if __name__ == "__main__":
    asyncio.run(check())


