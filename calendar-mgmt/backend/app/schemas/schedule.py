from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime


class ScheduleCreate(BaseModel):
    employee_id: str
    shift_template_id: str
    workplace_id: Optional[str] = None
    date: date
    notes: Optional[str] = None


class ScheduleUpdate(BaseModel):
    shift_template_id: Optional[str] = None
    workplace_id: Optional[str] = None
    actual_start_time: Optional[time] = None
    actual_end_time: Optional[time] = None
    notes: Optional[str] = None


class BulkScheduleItem(BaseModel):
    employee_id: str
    shift_template_id: str
    workplace_id: Optional[str] = None
    date: date


class BulkScheduleCreate(BaseModel):
    schedules: List[BulkScheduleItem]
    department_id: str


class ScheduleResponse(BaseModel):
    id: str
    employee_id: str
    shift_template_id: str
    workplace_id: Optional[str] = None
    date: date
    status: str
    actual_start_time: Optional[time] = None
    actual_end_time: Optional[time] = None
    total_hours: Optional[float] = None
    is_overtime: bool
    is_overtime_approved: bool
    notes: Optional[str] = None
    approved_by_id: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    adjusted_from_id: Optional[str] = None
    employee_name: Optional[str] = None
    shift_name: Optional[str] = None
    shift_color: Optional[str] = None
    workplace_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CalendarCell(BaseModel):
    date: str
    schedules: List[ScheduleResponse]


class CalendarResponse(BaseModel):
    month: str
    department_id: str
    cells: List[CalendarCell]
