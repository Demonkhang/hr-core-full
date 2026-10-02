from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class LeaveRegistrationCreate(BaseModel):
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    start_session: Optional[str] = "full"
    end_session: Optional[str] = "full"
    reason: Optional[str] = None


class LeaveRegistrationUpdate(BaseModel):
    leave_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_session: Optional[str] = None
    end_session: Optional[str] = None
    reason: Optional[str] = None


class LeaveRegistrationAction(BaseModel):
    rejection_reason: str


class LeaveRegistrationResponse(BaseModel):
    id: str
    employee_id: str
    leave_type: str
    start_date: date
    end_date: date
    start_session: str
    end_session: str
    total_days: float
    reason: Optional[str] = None
    status: str
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    is_active: bool
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
