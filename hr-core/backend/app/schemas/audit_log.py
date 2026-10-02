from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: Optional[datetime] = None
    success: bool = True

    class Config:
        from_attributes = True


class AuditLogStatsResponse(BaseModel):
    total: int
    by_action: list[dict]
    by_resource: list[dict]
    by_date: list[dict]
