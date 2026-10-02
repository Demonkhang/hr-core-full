"""Test fixtures cho integration tests.

Cấu hình:
- Sử dụng database `mbs_test` riêng (tách khỏi dev/prod DB).
- DATABASE_URL được set TRƯỚC khi import app để engine dùng đúng test DB.
- Tạo schema một lần ở session scope, truncate tất cả bảng trước mỗi test.
- Cung cấp fixtures factory để tạo nhanh: admin user, department, employee, position.
"""
import asyncio
import os
from typing import AsyncGenerator
from uuid import uuid4

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://mbs_user:mbs_pass@db:5432/mbs_test",
)
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings
from app.core.limiter import limiter
from app.core.security import hash_password
from app.database import get_db
from app.main import app
from app.models.base import Base
from app.models.department import Department
from app.models.employee import Employee
from app.models.position import Position
from app.models.user import User
from app.models.workplace import Workplace


limiter.enabled = False


test_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)
TestSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(autouse=True)
async def _ensure_schema_exists(request):
    """Chỉ tạo schema khi test có marker 'db' (integration test cần DB).
    Unit tests (hash, JWT, validation) không cần DB."""
    if request.node.get_closest_marker("db") is not None:
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield


def _tables_to_truncate() -> list[str]:
    return [
        "audit_logs",
        "refresh_tokens",
        "salary_history",
        "trainings",
        "employees",
        "positions",
        "workplaces",
        "departments",
        "users",
    ]


@pytest_asyncio.fixture(autouse=True)
async def _truncate_tables(request):
    """Chỉ truncate tables khi test có marker 'db'."""
    if request.node.get_closest_marker("db") is not None:
        async with test_engine.begin() as conn:
            await conn.execute(text("SET session_replication_role = 'replica'"))
            for table in _tables_to_truncate():
                try:
                    await conn.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
                except Exception:
                    pass
            await conn.execute(text("SET session_replication_role = 'origin'"))
    yield


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as s:
        yield s


@pytest_asyncio.fixture
async def db_department() -> Department:
    dept = Department(name="Phòng IT", code=f"IT-{uuid4().hex[:6]}", is_active=True)
    async with TestSessionLocal() as s:
        s.add(dept)
        await s.commit()
        await s.refresh(dept)
    return dept


@pytest_asyncio.fixture
async def db_department2() -> Department:
    dept = Department(name="Phòng Kế Toán", code=f"KT-{uuid4().hex[:6]}", is_active=True)
    async with TestSessionLocal() as s:
        s.add(dept)
        await s.commit()
        await s.refresh(dept)
    return dept


@pytest_asyncio.fixture
async def db_workplace() -> Workplace:
    wp = Workplace(name="Trụ sở chính", code="HQ", is_office_hours=True, is_active=True)
    async with TestSessionLocal() as s:
        s.add(wp)
        await s.commit()
        await s.refresh(wp)
    return wp


@pytest_asyncio.fixture
async def db_position_admin() -> Position:
    pos = Position(
        name="Quản trị hệ thống",
        code=f"ADMIN-{uuid4().hex[:6]}",
        scope="organization",
        can_manage_employees=True,
        can_manage_users=True,
        can_manage_settings=True,
        can_view_reports=True,
        can_approve_schedule=True,
        can_create_schedule=True,
        can_update_schedule=True,
        can_delete_schedule=True,
        can_read_schedule=True,
        is_active=True,
    )
    async with TestSessionLocal() as s:
        s.add(pos)
        await s.commit()
        await s.refresh(pos)
    return pos


@pytest_asyncio.fixture
async def db_position_manager() -> Position:
    pos = Position(
        name="Trưởng phòng",
        code=f"MGR-{uuid4().hex[:6]}",
        scope="department",
        can_manage_employees=True,
        can_approve_schedule=True,
        can_view_reports=True,
        can_read_schedule=True,
        is_active=True,
    )
    async with TestSessionLocal() as s:
        s.add(pos)
        await s.commit()
        await s.refresh(pos)
    return pos


@pytest_asyncio.fixture
async def db_admin_user(db_department: Department, db_position_admin: Position) -> User:
    user = User(
        username="admin",
        email="admin@test.com",
        hashed_password=hash_password("AdminPass1!"),
        full_name="Test Admin",
        is_super_admin=True,
        is_active=True,
        must_change_password=False,
    )
    async with TestSessionLocal() as s:
        s.add(user)
        await s.commit()
        await s.refresh(user)
    return user


@pytest_asyncio.fixture
async def db_manager_user(
    db_department: Department, db_position_manager: Position
) -> User:
    user = User(
        username="manager",
        email="manager@test.com",
        hashed_password=hash_password("ManagerPass1!"),
        full_name="Test Manager",
        is_super_admin=False,
        department_id=db_department.id,
        is_active=True,
        must_change_password=False,
    )
    async with TestSessionLocal() as s:
        s.add(user)
        await s.commit()
        await s.refresh(user)
    return user


@pytest_asyncio.fixture
async def db_employee(
    db_department: Department, db_workplace: Workplace, db_position_admin: Position
) -> Employee:
    emp = Employee(
        department_id=db_department.id,
        workplace_id=db_workplace.id,
        position_id=db_position_admin.id,
        full_name="Nguyễn Văn A",
        employee_code=f"EMP-{uuid4().hex[:6]}",
        phone="0901234567",
        email="nva@test.com",
        is_active=True,
    )
    async with TestSessionLocal() as s:
        s.add(emp)
        await s.commit()
        await s.refresh(emp)
    return emp


@pytest_asyncio.fixture
async def auth_headers(async_client: AsyncClient, db_admin_user: User) -> dict:
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "AdminPass1!"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def manager_auth_headers(
    async_client: AsyncClient, db_manager_user: User
) -> dict:
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"username": "manager", "password": "ManagerPass1!"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
