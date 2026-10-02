from sqlalchemy import Column, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.models.employee import Employee


class Department(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "departments"

    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    head_id = Column(ForeignKey("employees.id"), nullable=True, index=True)

    employees = relationship("Employee", back_populates="department", foreign_keys=[Employee.department_id])
    head = relationship("Employee", foreign_keys=[head_id])
