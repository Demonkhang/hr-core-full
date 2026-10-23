from sqlalchemy import Column, String, Boolean, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class EmployeeStatus:
    ACTIVE = "active"
    RESIGNED = "resigned"
    RETIRED = "retired"
    TERMINATED = "terminated"
    CONTRACT_EXPIRED = "contract_expired"

    ALL = [ACTIVE, RESIGNED, RETIRED, TERMINATED, CONTRACT_EXPIRED]


class Employee(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "employees"

    department_id = Column(ForeignKey("departments.id"), nullable=False, index=True)
    workplace_id = Column(ForeignKey("workplaces.id"), nullable=True, index=True)
    position_id = Column(ForeignKey("positions.id"), nullable=True, index=True)
    job_position_id = Column(ForeignKey("job_positions.id"), nullable=True, index=True)
    full_name = Column(String(100), nullable=False)
    position = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    employee_code = Column(String(20), unique=True, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    status = Column(String(30), nullable=True, index=True)
    hire_date = Column(Date, nullable=True, index=True)

    department = relationship("Department", back_populates="employees", foreign_keys=[department_id])
    workplace = relationship("Workplace", back_populates="employees")
    position_rel = relationship("Position", back_populates="employees")
    job_position = relationship("JobPosition", back_populates="employees")
    salary_history = relationship("SalaryHistory", back_populates="employee", cascade="all")
    trainings = relationship("Training", back_populates="employee", cascade="all")
    contracts = relationship("Contract", back_populates="employee", cascade="all, delete-orphan", order_by="Contract.start_date.desc()")
