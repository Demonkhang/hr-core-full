from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WorkplaceCreate(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    is_office_hours: bool = False


class WorkplaceUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    is_office_hours: Optional[bool] = None
    is_active: Optional[bool] = None


class WorkplaceResponse(BaseModel):
    id: str
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    is_office_hours: bool
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
