from sqlalchemy import Column, String, Text, Boolean, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class JobPosition(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "job_positions"

    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    professional_level = Column(Integer, nullable=False, default=1)
    required_qualification_level = Column(String(50), nullable=True)
    required_specialty = Column(String(100), nullable=True)
    max_headcount = Column(Integer, nullable=False, default=1)
    workplace_id = Column(ForeignKey("workplaces.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True, index=True)

    employees = relationship("Employee", back_populates="job_position")
    workplace = relationship("Workplace")

