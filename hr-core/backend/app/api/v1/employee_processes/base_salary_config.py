from typing import List, Optional
from fastapi import APIRouter, Depends
from app.core.exceptions import NotFoundError, ConflictError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.schemas.salary_history import (
    BaseSalaryConfigCreate, BaseSalaryConfigUpdate, BaseSalaryConfigResponse,
)
from app.models.salary_history import BaseSalaryConfig
from app.models.user import User

router = APIRouter()


@router.get(
    "/base-salary-config",
    response_model=List[BaseSalaryConfigResponse],
)
async def list_base_salary_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BaseSalaryConfig).order_by(BaseSalaryConfig.year.desc())
    )
    return result.scalars().all()


@router.post(
    "/base-salary-config",
    response_model=BaseSalaryConfigResponse,
    status_code=201,
)
async def create_base_salary_config(
    body: BaseSalaryConfigCreate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_settings")),
):
    existing = await db.execute(
        select(BaseSalaryConfig).where(BaseSalaryConfig.year == body.year)
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Năm này đã có cấu hình lương cơ sở")

    config = BaseSalaryConfig(year=body.year, amount=body.amount)
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put(
    "/base-salary-config/{config_id}",
    response_model=BaseSalaryConfigResponse,
)
async def update_base_salary_config(
    config_id: str,
    body: BaseSalaryConfigUpdate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_settings")),
):
    config = await db.get(BaseSalaryConfig, config_id)
    if not config:
        raise NotFoundError(detail="Không tìm thấy cấu hình lương cơ sở")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/base-salary-config/{config_id}", status_code=204)
async def delete_base_salary_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_settings")),
):
    config = await db.get(BaseSalaryConfig, config_id)
    if not config:
        raise NotFoundError(detail="Không tìm thấy cấu hình lương cơ sở")
    await db.delete(config)
    await db.commit()


@router.get("/base-salary-config/active", response_model=Optional[BaseSalaryConfigResponse])
async def get_active_base_salary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BaseSalaryConfig).where(BaseSalaryConfig.is_active == True).order_by(BaseSalaryConfig.year.desc()).limit(1)
    )
    return result.scalar_one_or_none()
