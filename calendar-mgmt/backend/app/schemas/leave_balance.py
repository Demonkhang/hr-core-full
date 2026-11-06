from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LeaveBalanceCreate(BaseModel):
    employee_id: str
    year: int
    total_allocated: Optional[float] = 12.0
    carried_over: Optional[float] = 0.0


class LeaveBalanceUpdate(BaseModel):
    total_allocated: Optional[float] = None
    carried_over: Optional[float] = None
    is_active: Optional[bool] = None


class LeaveBalanceResponse(BaseModel):
    id: str
    employee_id: str
    year: int
    total_allocated: float
    carried_over: float
    used: float
    remaining: float
    is_active: bool
    employee_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    hire_date: Optional[str] = None
    pending_days: float = 0.0
    other_leave_days: float = 0.0
    other_pending_days: float = 0.0
    sick_days: float = 0.0
    max_sick_days: float = 30.0
    personal_paid_days: float = 0.0
    personal_unpaid_days: float = 0.0
    maternity_days: float = 0.0
    total_taken_days: float = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
