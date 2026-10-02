from pydantic import BaseModel
from typing import Optional
from datetime import date, time, datetime


class OvertimeRegistrationCreate(BaseModel):
    employee_id: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    total_hours: Optional[float] = None
    reason: Optional[str] = None


class OvertimeRegistrationUpdate(BaseModel):
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    total_hours: Optional[float] = None
    reason: Optional[str] = None


class OvertimeRegistrationAction(BaseModel):
    rejection_reason: str


class OvertimeRegistrationResponse(BaseModel):
    id: str
    employee_id: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    total_hours: Optional[float] = None
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
