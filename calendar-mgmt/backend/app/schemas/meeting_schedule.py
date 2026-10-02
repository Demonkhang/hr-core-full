from pydantic import BaseModel
from typing import Optional, List
from datetime import date as _Date, time, datetime


class MeetingParticipantCreate(BaseModel):
    employee_id: str
    response_status: Optional[str] = "pending"


class MeetingParticipantResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    department_name: Optional[str] = None
    response_status: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingScheduleCreate(BaseModel):
    title: str
    meeting_type: str
    date: _Date
    start_time: time
    location: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[str] = None
    participant_ids: Optional[List[str]] = None


class MeetingScheduleUpdate(BaseModel):
    title: Optional[str] = None
    meeting_type: Optional[str] = None
    date: Optional[_Date] = None
    start_time: Optional[time] = None
    location: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[str] = None
    participant_ids: Optional[List[str]] = None


class MeetingScheduleResponse(BaseModel):
    id: str
    title: str
    meeting_type: str
    date: _Date
    start_time: time
    location: Optional[str] = None
    description: Optional[str] = None
    department_id: Optional[str] = None
    department_name: Optional[str] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    status: str
    approved_by_id: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    is_active: bool
    participants: Optional[List[MeetingParticipantResponse]] = None
    participant_count: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
