import enum
from sqlalchemy import Column, String, Text, Float, Boolean, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin


class LeaveType(str, enum.Enum):
    ANNUAL = "annual"
    PERSONAL_PAID = "personal_paid"
    PERSONAL_UNPAID = "personal_unpaid"
    SICK = "sick"
    MATERNITY = "maternity"


class LeaveRegistrationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class LeaveRegistration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "leave_registrations"

    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    leave_type = Column(String(30), nullable=False, default=LeaveType.ANNUAL, index=True)

    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)

    start_session = Column(String(15), default="full", nullable=False)
    end_session = Column(String(15), default="full", nullable=False)

    total_days = Column(Float, nullable=False)
    reason = Column(Text, nullable=True)

    status = Column(String(20), nullable=False, default=LeaveRegistrationStatus.PENDING, index=True)

    approved_by_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)

    __mapper_args__ = {
        "confirm_deleted_rows": False
    }
