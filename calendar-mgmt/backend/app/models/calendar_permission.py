from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin


class CalendarPermission(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "calendar_permissions"

    position_id = Column(UUID(as_uuid=True), nullable=False, index=True, unique=True)
    position_name = Column(String(100), nullable=False)
    position_code = Column(String(20), nullable=False)

    can_read_schedule = Column(Boolean, default=True)
    can_create_schedule = Column(Boolean, default=False)
    can_update_schedule = Column(Boolean, default=False)
    can_delete_schedule = Column(Boolean, default=False)
    can_approve_schedule = Column(Boolean, default=False)

    can_manage_leave = Column(Boolean, default=False)
    can_approve_leave = Column(Boolean, default=False)

    can_manage_overtime = Column(Boolean, default=False)
    can_approve_overtime = Column(Boolean, default=False)

    can_manage_meetings = Column(Boolean, default=False)
    can_approve_meetings = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True, index=True)
