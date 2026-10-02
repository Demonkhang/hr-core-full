import uuid
from sqlalchemy import Column, Float, Date, Integer, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class MonthlySummary(Base):
    __tablename__ = "monthly_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    month = Column(Date, nullable=False, index=True)
    total_hours = Column(Float, default=0)
    normal_hours = Column(Float, default=0)
    overtime_hours = Column(Float, default=0)
    total_shifts = Column(Integer, default=0)
    is_finalized = Column(Boolean, default=False, index=True)
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("employee_id", "month", name="uq_employee_month"),
    )
