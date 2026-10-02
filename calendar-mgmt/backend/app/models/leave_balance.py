from sqlalchemy import Column, Integer, Float, Boolean, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin


class LeaveBalance(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "leave_balances"

    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    total_allocated = Column(Float, default=12.0, nullable=False)
    carried_over = Column(Float, default=0.0, nullable=False)
    used = Column(Float, default=0.0, nullable=False)
    remaining = Column(Float, default=12.0, nullable=False)
    is_active = Column(Boolean, default=True)

    __table_args__ = (
        Index(
            "uq_employee_leave_year_active",
            "employee_id", "year",
            unique=True,
            postgresql_where=Column("is_active").is_(True),
        ),
    )
