import enum
from sqlalchemy import Column, String, Text, Boolean, Date, Time, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin


class MeetingType(str, enum.Enum):
    MEETING = "meeting"
    SITE_SURVEY = "site_survey"
    TRAINING = "training"


class MeetingStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class MeetingSchedule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "meeting_schedules"

    title = Column(String(255), nullable=False)
    meeting_type = Column(String(20), nullable=False, default=MeetingType.MEETING, index=True)
    date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    location = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    department_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    created_by_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    status = Column(String(20), nullable=False, default=MeetingStatus.PENDING, index=True)
    approved_by_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
