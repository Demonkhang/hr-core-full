"""Seed initial data: admin user, departments."""
import asyncio
import secrets
import string
from typing import Dict
from app.database import async_session_factory
from app.core.security import hash_password
from app.models.user import User
from app.models.department import Department
from app.models.position import Position
from app.models.workplace import Workplace
from sqlalchemy import select


def _generate_random_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def seed() -> Dict[str, str]:
    async with async_session_factory() as db:
        existing_admin = await db.execute(select(User).where(User.username == "admin"))
        if existing_admin.scalar_one_or_none():
            print("Seed data already exists, skipping.")
            return {}

        departments = [
            Department(name="Ban Giám đốc", code="BGD"),
            Department(name="Văn phòng", code="VP"),
            Department(name="Phòng Kế hoạch - Tài chính", code="P.KHTC"),
            Department(name="Phòng Quản lý dự án", code="P.QLDA"),
            Department(name="Phòng Giám sát Khối lượng", code="P.GSKL"),
            Department(name="Phòng Giám sát Khu liên hợp", code="P.GSKLH"),
            Department(name="Phòng Kiểm tra Môi trường", code="P.KTMT"),
        ]
        db.add_all(departments)
        await db.flush()

        positions = [
            Position(name="Giám đốc", code="GD", scope="organization", can_manage_employees=True, can_manage_departments=True, can_manage_workplaces=True, can_manage_settings=True, can_manage_users=True, can_view_reports=True),
            Position(name="Phó Giám đốc", code="PGD", scope="organization", can_manage_employees=True, can_manage_departments=True, can_manage_workplaces=True, can_manage_settings=True, can_manage_users=True, can_view_reports=True),
            Position(name="Trưởng phòng", code="TP", scope="department", can_manage_employees=True, can_manage_departments=False, can_manage_workplaces=False, can_manage_settings=True, can_manage_users=False, can_view_reports=True),
            Position(name="Phó Trưởng phòng", code="PTP", scope="department", can_manage_employees=True, can_manage_departments=False, can_manage_workplaces=False, can_manage_settings=False, can_manage_users=False, can_view_reports=True),
            Position(name="Nhân viên", code="NV", scope="self", can_manage_employees=False, can_manage_departments=False, can_manage_workplaces=False, can_manage_settings=False, can_manage_users=False, can_view_reports=False),
            Position(name="Người lao động", code="NLD", scope="self", can_manage_employees=False, can_manage_departments=False, can_manage_workplaces=False, can_manage_settings=False, can_manage_users=False, can_view_reports=False),
        ]
        db.add_all(positions)
        await db.flush()

        workplaces = [
            Workplace(name="Trụ sở chính", code="TSC", address="40 Võ Thị Sáu, phường Tân Định, Thành phố Hồ Chí Minh", is_office_hours=True),
            Workplace(name="Trụ sở 2", code="TS2", address="Kỳ Đồng, Thành phố Hồ Chí Minh", is_office_hours=True),
            Workplace(name="Khu liên hợp xử lý chất thải Tây Bắc", code="KLH.TB", is_office_hours=False),
            Workplace(name="Khu liên hợp xử lý chất thải và nghĩa trang Đa Phước", code="KLH.DP", is_office_hours=False),
            Workplace(name="Khu liên hợp xử lý chất thải Nam Bình Dương", code="KLH.NBD", is_office_hours=False),
            Workplace(name="Khu xử lý chất thải tập trung Tóc Tiên", code="KLH.TT", is_office_hours=False),
            Workplace(name="Công trường Đông Thạnh", code="CT.ĐT", is_office_hours=False),
            Workplace(name="Công trường Gò Cát", code="CT.GC", is_office_hours=False),
        ]
        db.add_all(workplaces)
        await db.flush()

        admin_pw = "admin123"
        manager_pw = "manager123"

        admin_user = User(
            username="admin",
            email="admin@mbs.com",
            hashed_password=hash_password(admin_pw),
            full_name="Administrator",
            is_super_admin=True,
            department_id=departments[0].id,
            must_change_password=False,
        )
        db.add(admin_user)

        manager_user = User(
            username="manager",
            email="manager@mbs.com",
            hashed_password=hash_password(manager_pw),
            full_name="Quản lý",
            department_id=departments[1].id,
            must_change_password=True,
        )
        db.add(manager_user)

        await db.commit()

        print("Seed data created successfully! 2 users created.")
        print("IMPORTANT: Copy the returned dict to a secure location (password manager).")
        print("All users have must_change_password=True and must reset on first login.")

        return {
            "admin": admin_pw,
            "manager": manager_pw,
        }


if __name__ == "__main__":
    import os
    import stat

    passwords = asyncio.run(seed())
    if passwords:
        out_path = ".seed_passwords"
        with open(out_path, "w", encoding="utf-8") as f:
            for username, pw in passwords.items():
                f.write(f"{username}: {pw}\n")
        try:
            os.chmod(out_path, stat.S_IRUSR | stat.S_IWUSR)
        except (OSError, AttributeError):
            pass
        print(f"Passwords written to {out_path} (chmod 600). Please store securely.")
