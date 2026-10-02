from pydantic import BaseModel
from typing import Optional
from datetime import time, datetime


class ShiftTemplateCreate(BaseModel):
    workplace_id: str
    department_ids: list[str] = []
    name: str
    start_time: time
    end_time: time
    is_overnight: bool = False
    color: str = "#1890ff"


class ShiftTemplateUpdate(BaseModel):
    workplace_id: Optional[str] = None
    department_ids: Optional[list[str]] = None
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_overnight: Optional[bool] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class ShiftTemplateResponse(BaseModel):
    id: str
    workplace_id: str
    department_ids: list[str] = []
    name: str
    start_time: time
    end_time: time
    is_overnight: bool
    color: str
    is_active: bool
    workplace_name: Optional[str] = None
    department_names: list[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
