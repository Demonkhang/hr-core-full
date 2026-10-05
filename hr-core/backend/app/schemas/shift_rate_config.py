from datetime import datetime
from typing import Optional
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class ShiftRateConfigCreate(BaseModel):
    code: str = Field(..., max_length=30, description="Mã ca trực (NORMAL, NIGHT, WEEKEND, HOLIDAY)")
    name: str = Field(..., max_length=100, description="Tên cấu hình ca trực")
    multiplier: Decimal = Field(default=Decimal("1.0"), description="Hệ số nhân tiền công")
    allowance_amount: Decimal = Field(default=Decimal("0.0"), description="Mức tiền phụ cấp ăn ca/đêm cố định")
    description: Optional[str] = None
    is_active: bool = True


class ShiftRateConfigUpdate(BaseModel):
    name: Optional[str] = None
    multiplier: Optional[Decimal] = None
    allowance_amount: Optional[Decimal] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ShiftRateConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID | str
    code: str
    name: str
    multiplier: Decimal
    allowance_amount: Decimal
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime



class PublicSectorSalaryConfigResponse(BaseModel):
    year: int
    base_salary: Decimal
    standard_working_days: int = 22
    insurance_cap: Decimal = Decimal("46800000.00")
    personal_tax_deduction: Decimal = Decimal("11000000.00")
    dependent_tax_deduction: Decimal = Decimal("4400000.00")
    shift_rates: list[ShiftRateConfigResponse]
