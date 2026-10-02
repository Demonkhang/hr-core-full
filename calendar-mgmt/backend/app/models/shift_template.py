from sqlalchemy import Column, String, Time, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from app.models.base import Base, UUIDMixin, TimestampMixin


class ShiftTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "shift_templates"

    workplace_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    department_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=False, default=[])
    name = Column(String(100), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    is_overnight = Column(Boolean, default=False)
    color = Column(String(7), default="#1890ff")
    is_active = Column(Boolean, default=True, index=True)
