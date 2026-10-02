from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


class SalaryHistoryCreate(BaseModel):
    coefficient: Decimal
    allowance_coefficient: Decimal = Decimal(0)
    effective_date: date
    decision_number: Optional[str] = None
    notes: Optional[str] = None


class SalaryHistoryUpdate(BaseModel):
    coefficient: Optional[Decimal] = None
    allowance_coefficient: Optional[Decimal] = None
    effective_date: Optional[date] = None
    decision_number: Optional[str] = None
    notes: Optional[str] = None


class SalaryHistoryResponse(BaseModel):
    id: str
    employee_id: str
    coefficient: Decimal
    allowance_coefficient: Decimal
    effective_date: date
    decision_number: Optional[str] = None
    notes: Optional[str] = None
    employee_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BaseSalaryConfigCreate(BaseModel):
    year: int
    amount: Decimal


class BaseSalaryConfigUpdate(BaseModel):
    amount: Optional[Decimal] = None
    is_active: Optional[bool] = None


class BaseSalaryConfigResponse(BaseModel):
    id: str
    year: int
    amount: Decimal
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("id", mode="before")
    @classmethod
    def _coerce_uuid(cls, v):
        return str(v) if isinstance(v, UUID) else v

    class Config:
        from_attributes = True
