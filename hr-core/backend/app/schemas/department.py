from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DepartmentHead(BaseModel):
    id: str
    full_name: str
    employee_code: Optional[str] = None

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    head_id: Optional[str] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    head_id: Optional[str] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool
    head_id: Optional[str] = None
    head: Optional[DepartmentHead] = None
    employee_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
