from sqlalchemy import Column, String, Text, Float, Boolean, Date, Time, DateTime
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.models.base import Base, UUIDMixin, TimestampMixin


class OvertimeRegistrationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class OvertimeRegistration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "overtime_registrations"

    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    total_hours = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default=OvertimeRegistrationStatus.PENDING, index=True)
    approved_by_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
