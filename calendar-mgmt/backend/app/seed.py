"""Seed initial data: shift templates, overtime config."""
import asyncio
import secrets
import string
from typing import Dict
from app.database import async_session_factory
from app.models.shift_template import ShiftTemplate
from app.models.overtime_config import OvertimeConfig
from app.models.leave_balance import LeaveBalance
from datetime import date, time
from sqlalchemy import select


def _generate_random_password(length: int = 16) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def seed() -> Dict[str, str]:
    async with async_session_factory() as db:
        existing = await db.execute(select(ShiftTemplate).limit(1))
        if existing.scalar_one_or_none():
            print("Seed data already exists, skipping.")
            return {}

        templates = [
            ShiftTemplate(workplace_id="00000000-0000-0000-0000-000000000001", name="Hành chính sáng", start_time=time(7, 30), end_time=time(12, 0), color="#1890ff"),
            ShiftTemplate(workplace_id="00000000-0000-0000-0000-000000000001", name="Hành chính chiều", start_time=time(13, 0), end_time=time(17, 0), color="#52c41a"),
            ShiftTemplate(workplace_id="00000000-0000-0000-0000-000000000002", name="Ca sáng", start_time=time(6, 0), end_time=time(14, 0), color="#1890ff"),
            ShiftTemplate(workplace_id="00000000-0000-0000-0000-000000000002", name="Ca chiều", start_time=time(14, 0), end_time=time(22, 0), color="#722ed1"),
            ShiftTemplate(workplace_id="00000000-0000-0000-0000-000000000002", name="Ca đêm", start_time=time(22, 0), end_time=time(6, 0), is_overnight=True, color="#eb2f96"),
            ShiftTemplate(workplace_id="00000000-0000-0000-0000-000000000003", name="Ca 12h", start_time=time(6, 0), end_time=time(18, 0), color="#fa8c16"),
        ]
        db.add_all(templates)

        ot_config = OvertimeConfig(
            max_hours_per_month=180.0,
            overtime_rate=1.5,
            effective_from=date(2026, 1, 1),
        )
        db.add(ot_config)

        await db.commit()
        print("Seed data created successfully!")
        print("Created shift templates and overtime config.")

        return {}


if __name__ == "__main__":
    passwords = asyncio.run(seed())
