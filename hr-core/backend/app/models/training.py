from sqlalchemy import Column, String, Text, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class Training(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "trainings"

    employee_id = Column(ForeignKey("employees.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    issuing_body = Column(String(200), nullable=True)
    issue_date = Column(Date, nullable=False, index=True)
    expiry_date = Column(Date, nullable=True, index=True)
    credential_type = Column(String(10), nullable=False)
    classification = Column(String(20), nullable=True)
    major = Column(String(200), nullable=True)
    certificate_number = Column(String(50), nullable=True)
    training_form = Column(String(30), nullable=True)
    notes = Column(Text, nullable=True)

    employee = relationship("Employee", back_populates="trainings")
