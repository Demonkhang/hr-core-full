from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PositionCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    scope: str = "self"
    can_manage_employees: bool = False
    can_manage_departments: bool = False
    can_manage_workplaces: bool = False
    can_manage_settings: bool = False
    can_manage_users: bool = False
    can_view_reports: bool = False


class PositionUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    scope: Optional[str] = None
    can_manage_employees: Optional[bool] = None
    can_manage_departments: Optional[bool] = None
    can_manage_workplaces: Optional[bool] = None
    can_manage_settings: Optional[bool] = None
    can_manage_users: Optional[bool] = None
    can_view_reports: Optional[bool] = None
    is_active: Optional[bool] = None


class PositionResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    scope: str
    can_manage_employees: bool
    can_manage_departments: bool
    can_manage_workplaces: bool
    can_manage_settings: bool
    can_manage_users: bool
    can_view_reports: bool
    is_active: bool
    employee_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
