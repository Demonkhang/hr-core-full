from typing import List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.schemas.shift_rate_config import (
    ShiftRateConfigCreate, ShiftRateConfigUpdate, ShiftRateConfigResponse, PublicSectorSalaryConfigResponse,
)
from app.models.shift_rate_config import ShiftRateConfig
from app.models.salary_history import BaseSalaryConfig
from app.models.user import User
from app.core.exceptions import NotFoundError, ConflictError

router = APIRouter()


@router.get(
    "/shift-rate-configs",
    response_model=List[ShiftRateConfigResponse],
)
async def list_shift_rate_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ShiftRateConfig).order_by(ShiftRateConfig.code)
    )
    return result.scalars().all()


@router.post(
    "/shift-rate-configs",
    response_model=ShiftRateConfigResponse,
    status_code=201,
)
async def create_shift_rate_config(
    body: ShiftRateConfigCreate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_settings")),
):
    existing = await db.execute(
        select(ShiftRateConfig).where(ShiftRateConfig.code == body.code.upper())
    )
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Mã ca trực này đã tồn tại")

    config = ShiftRateConfig(
        code=body.code.upper(),
        name=body.name,
        multiplier=body.multiplier,
        allowance_amount=body.allowance_amount,
        description=body.description,
        is_active=body.is_active,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


@router.put(
    "/shift-rate-configs/{config_id}",
    response_model=ShiftRateConfigResponse,
)
async def update_shift_rate_config(
    config_id: str,
    body: ShiftRateConfigUpdate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_settings")),
):
    config = await db.get(ShiftRateConfig, config_id)
    if not config:
        raise NotFoundError(detail="Không tìm thấy cấu hình ca trực")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    return config


@router.delete("/shift-rate-configs/{config_id}", status_code=204)
async def delete_shift_rate_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_settings")),
):
    config = await db.get(ShiftRateConfig, config_id)
    if not config:
        raise NotFoundError(detail="Không tìm thấy cấu hình ca trực")
    await db.delete(config)
    await db.commit()


@router.get(
    "/salary-config/public-sector-active",
    response_model=PublicSectorSalaryConfigResponse,
)
async def get_public_sector_active_config(
    db: AsyncSession = Depends(get_db),
):
    # Fetch active base salary config
    result_base = await db.execute(
        select(BaseSalaryConfig).where(BaseSalaryConfig.is_active == True).order_by(BaseSalaryConfig.year.desc()).limit(1)
    )
    base_salary_cfg = result_base.scalar_one_or_none()
    base_salary_val = Decimal(str(base_salary_cfg.amount)) if base_salary_cfg else Decimal("2340000.00")
    year_val = base_salary_cfg.year if base_salary_cfg else 2026

    # Fetch active shift rates
    result_shifts = await db.execute(
        select(ShiftRateConfig).where(ShiftRateConfig.is_active == True).order_by(ShiftRateConfig.code)
    )
    shift_rates = result_shifts.scalars().all()

    # Insurance cap = 20 * base_salary
    insurance_cap = base_salary_val * Decimal("20.0")

    return PublicSectorSalaryConfigResponse(
        year=year_val,
        base_salary=base_salary_val,
        standard_working_days=22,
        insurance_cap=insurance_cap,
        personal_tax_deduction=Decimal("11000000.00"),
        dependent_tax_deduction=Decimal("4400000.00"),
        shift_rates=[
            ShiftRateConfigResponse(
                id=str(s.id),
                code=s.code,
                name=s.name,
                multiplier=Decimal(str(s.multiplier)),
                allowance_amount=Decimal(str(s.allowance_amount)),
                description=s.description,
                is_active=s.is_active,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in shift_rates
        ],
    )
