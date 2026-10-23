from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, Field


class ContractAppendixBase(BaseModel):
    appendix_number: str = Field(..., max_length=50)
    effective_date: date
    change_type: str = Field(..., max_length=30)
    content: str
    new_basic_salary: Optional[Decimal] = None
    new_end_date: Optional[date] = None
    signing_date: date
    file_attachment_url: Optional[str] = None


class ContractAppendixCreate(ContractAppendixBase):
    pass


class ContractAppendixResponse(ContractAppendixBase):
    id: UUID
    contract_id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContractBase(BaseModel):
    employee_id: UUID
    contract_number: str = Field(..., max_length=50)
    contract_type: str = Field(..., max_length=30)
    contract_sequence: Optional[int] = 1
    start_date: date
    end_date: Optional[date] = None
    signing_date: date
    signatory_name: Optional[str] = Field(None, max_length=100)
    signatory_title: Optional[str] = Field(None, max_length=100)
    job_title: Optional[str] = Field(None, max_length=100)
    department_id: Optional[UUID] = None
    workplace_id: Optional[UUID] = None
    basic_salary: Optional[Decimal] = None
    salary_rate: Optional[int] = 100
    allowance_amount: Optional[Decimal] = Decimal("0")
    working_hours_description: Optional[str] = None
    notes: Optional[str] = None


class ContractCreate(ContractBase):
    file_attachment_url: Optional[str] = None


class ContractUpdate(BaseModel):
    contract_number: Optional[str] = None
    contract_type: Optional[str] = None
    contract_sequence: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    signing_date: Optional[date] = None
    signatory_name: Optional[str] = None
    signatory_title: Optional[str] = None
    job_title: Optional[str] = None
    department_id: Optional[UUID] = None
    workplace_id: Optional[UUID] = None
    basic_salary: Optional[Decimal] = None
    salary_rate: Optional[int] = None
    allowance_amount: Optional[Decimal] = None
    working_hours_description: Optional[str] = None
    status: Optional[str] = None
    file_attachment_url: Optional[str] = None
    notes: Optional[str] = None


class ContractRenewRequest(BaseModel):
    contract_number: str = Field(..., max_length=50)
    contract_type: str = Field(..., max_length=30)
    start_date: date
    end_date: Optional[date] = None
    signing_date: date
    signatory_name: Optional[str] = None
    signatory_title: Optional[str] = None
    job_title: Optional[str] = None
    basic_salary: Optional[Decimal] = None
    salary_rate: Optional[int] = 100
    allowance_amount: Optional[Decimal] = Decimal("0")
    notes: Optional[str] = None
    file_attachment_url: Optional[str] = None


class ContractTerminateRequest(BaseModel):
    termination_date: date
    termination_reason: str
    deactivate_employee: bool = True  # Tự động chuyển nhân viên sang 'resigned' / ngừng hoạt động


class ContractResponse(ContractBase):
    id: UUID
    status: str
    termination_date: Optional[date] = None
    termination_reason: Optional[str] = None
    file_attachment_url: Optional[str] = None
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    workplace_name: Optional[str] = None
    days_remaining: Optional[int] = None
    is_expiring_soon: bool = False
    is_expired: bool = False
    appendices: List[ContractAppendixResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContractDashboardSummary(BaseModel):
    total_active: int = 0
    expiring_15_days: int = 0
    expiring_30_days: int = 0
    expiring_60_days: int = 0
    overdue_count: int = 0
    indefinite_count: int = 0
    definite_count: int = 0
    probation_count: int = 0
