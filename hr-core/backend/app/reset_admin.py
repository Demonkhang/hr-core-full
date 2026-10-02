"""Reset admin password."""
import asyncio
from app.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from sqlalchemy import select


async def reset_admin():
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.username == "admin"))
        user = result.scalar_one_or_none()

        if not user:
            print("Admin user not found. Run seed.py first.")
            return

        new_password = "Admin@123"
        user.hashed_password = hash_password(new_password)
        user.must_change_password = False
        await db.commit()

        print(f"Admin password reset successfully!")
        print(f"Username: admin")
        print(f"Password: {new_password}")


if __name__ == "__main__":
    asyncio.run(reset_admin())
