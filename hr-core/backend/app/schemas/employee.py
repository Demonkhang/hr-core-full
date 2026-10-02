from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class EmployeeCreate(BaseModel):
    department_id: str
    workplace_id: Optional[str] = None
    position_id: Optional[str] = None
    job_position_id: Optional[str] = None
    full_name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    employee_code: Optional[str] = None
    hire_date: Optional[date] = None
    create_account: bool = False


class EmployeeUpdate(BaseModel):
    department_id: Optional[str] = None
    workplace_id: Optional[str] = None
    position_id: Optional[str] = None
    job_position_id: Optional[str] = None
    full_name: Optional[str] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    employee_code: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None


class EmployeeDeactivate(BaseModel):
    status: str


class EmployeeResponse(BaseModel):
    id: str
    department_id: str
    workplace_id: Optional[str] = None
    position_id: Optional[str] = None
    job_position_id: Optional[str] = None
    full_name: str
    position: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    employee_code: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: bool
    status: Optional[str] = None
    department_name: Optional[str] = None
    workplace_name: Optional[str] = None
    position_name: Optional[str] = None
    job_position_name: Optional[str] = None
    has_account: bool = False
    user_id: Optional[str] = None
    username: Optional[str] = None
    is_super_admin: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
