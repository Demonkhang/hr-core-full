from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: str
    employee_id: str
    schedule_id: str | None = None
    title: str
    message: str
    type: str
    is_read: bool
    created_at: datetime | None = None


class UnreadCountResponse(BaseModel):
    count: int
