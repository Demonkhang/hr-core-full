from sqlalchemy import Column, String, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.core.constants import SCOPE_SELF


class Position(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "positions"

    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    scope = Column(String(20), nullable=False, default=SCOPE_SELF, index=True)
    can_manage_employees = Column(Boolean, default=False)
    can_manage_departments = Column(Boolean, default=False)
    can_manage_workplaces = Column(Boolean, default=False)
    can_manage_settings = Column(Boolean, default=False)
    can_manage_users = Column(Boolean, default=False)
    can_view_reports = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)

    employees = relationship("Employee", back_populates="position_rel")
