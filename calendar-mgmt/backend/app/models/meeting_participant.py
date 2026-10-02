import enum
from sqlalchemy import Column, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base, UUIDMixin, TimestampMixin


class ParticipantResponse(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    TENTATIVE = "tentative"


class MeetingParticipant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "meeting_participants"

    meeting_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    response_status = Column(String(20), nullable=False, default=ParticipantResponse.PENDING, index=True)

    __table_args__ = (
        UniqueConstraint("meeting_id", "employee_id", name="uq_meeting_employee"),
    )
