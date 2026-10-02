from sqlalchemy import Column, Integer, String, Text, ForeignKey, Date, Numeric, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class SalaryHistory(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "salary_history"

    employee_id = Column(ForeignKey("employees.id"), nullable=False, index=True)
    coefficient = Column(Numeric(5, 2), nullable=False)
    allowance_coefficient = Column(Numeric(5, 2), default=0)
    effective_date = Column(Date, nullable=False, index=True)
    decision_number = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="salary_history")


class BaseSalaryConfig(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "base_salary_config"

    year = Column(Integer, unique=True, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
