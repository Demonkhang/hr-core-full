from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base, UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    is_super_admin = Column(Boolean, default=False)
    employee_id = Column(ForeignKey("employees.id"), nullable=True, index=True)
    department_id = Column(ForeignKey("departments.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, index=True)
    must_change_password = Column(Boolean, default=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    employee = relationship("Employee", lazy="selectin")
    department = relationship("Department", lazy="selectin")
