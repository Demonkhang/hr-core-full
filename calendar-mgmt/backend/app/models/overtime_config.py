import uuid
from sqlalchemy import Column, Float, Date, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class OvertimeConfig(Base):
    __tablename__ = "overtime_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    max_hours_per_month = Column(Float, default=180.0, nullable=False)
    overtime_rate = Column(Float, default=1.5)
    effective_from = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
