from sqlalchemy import Column, String, Date, Time, Float, Boolean, Text, Enum, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.core.constants import ScheduleStatus


class Schedule(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "schedules"

    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    shift_template_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    workplace_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(Enum(ScheduleStatus), default=ScheduleStatus.DRAFT, index=True)

    actual_start_time = Column(Time, nullable=True)
    actual_end_time = Column(Time, nullable=True)
    total_hours = Column(Float, nullable=True)
    is_overtime = Column(Boolean, default=False)
    is_overtime_approved = Column(Boolean, default=False)

    notes = Column(Text, nullable=True)
    created_by_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    approved_by_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    adjusted_from_id = Column(UUID(as_uuid=True), nullable=True, index=True)

    __table_args__ = (
        UniqueConstraint("employee_id", "date", "shift_template_id", name="uq_employee_date_shift"),
    )
