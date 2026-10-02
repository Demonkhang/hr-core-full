from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Workplace(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workplaces"

    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=True, index=True)
    address = Column(Text, nullable=True)
    is_office_hours = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)

    employees = relationship("Employee", back_populates="workplace")
