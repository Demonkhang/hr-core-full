"""Reset admin password to a known value."""
import asyncio
from app.database import async_session_factory
from app.core.security import hash_password
from sqlalchemy import select
from app.models.user import User

async def reset():
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()
        if not user:
            print("Admin user not found.")
            return
        new_pw = "Admin@123"
        user.hashed_password = hash_password(new_pw)
        user.must_change_password = False
        await db.commit()
        print(f"Admin password reset to: {new_pw}")

if __name__ == "__main__":
    asyncio.run(reset())
