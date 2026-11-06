from sqlalchemy import Column, String, Date, Numeric, Text, ForeignKey
from app.models.base import Base, UUIDMixin, TimestampMixin


class MobileEssSchedule(Base, UUIDMixin, TimestampMixin):
    """Bảng lưu lịch công tác / lịch làm việc / lịch trực cá nhân trên Core Mobile (Độc lập với Core Website)"""
    __tablename__ = "mobile_ess_schedules"

    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    schedule_date = Column(Date, nullable=False, index=True)
    start_time = Column(String(20), nullable=False, default="07:30")
    end_time = Column(String(20), nullable=False, default="17:00")
    schedule_type = Column(String(50), nullable=False, default="OFFICE_WORK")  # OFFICE_WORK | BUSINESS_TRIP | MEETING | DUTY_SHIFT
    title = Column(String(250), nullable=False)
    location = Column(String(250), nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="CONFIRMED")


class MobileEssLeaveRequest(Base, UUIDMixin, TimestampMixin):
    """Bảng lưu đơn xin nghỉ phép cá nhân trên Core Mobile (Độc lập với Core Website)"""
    __tablename__ = "mobile_ess_leave_requests"

    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    leave_type = Column(String(50), nullable=False, default="ANNUAL_LEAVE")  # ANNUAL_LEAVE | PAID_PERSONAL | SICK_LEAVE | COMPENSATORY | UNPAID_LEAVE
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    session_type = Column(String(30), nullable=False, default="FULL_DAY")  # FULL_DAY | MORNING | AFTERNOON
    total_days = Column(Numeric(5, 1), nullable=False, default=1.0)
    reason = Column(Text, nullable=False)
    handover_person = Column(String(150), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    status = Column(String(30), nullable=False, default="PENDING", index=True)  # PENDING | APPROVED | REJECTED | CANCELLED
    reviewer_note = Column(Text, nullable=True)


class MobileEssOvertimeRequest(Base, UUIDMixin, TimestampMixin):
    """Bảng lưu phiếu đăng ký làm thêm giờ (OT) cá nhân trên Core Mobile (Độc lập với Core Website)"""
    __tablename__ = "mobile_ess_overtime_requests"

    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    work_date = Column(Date, nullable=False, index=True)
    start_time = Column(String(20), nullable=False, default="17:30")
    end_time = Column(String(20), nullable=False, default="20:30")
    total_hours = Column(Numeric(5, 1), nullable=False, default=3.0)
    day_type = Column(String(40), nullable=False, default="WEEKDAY_150")  # WEEKDAY_150 | WEEKEND_200 | HOLIDAY_300
    work_location = Column(String(150), nullable=True, default="Tại cơ quan")
    task_description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="PENDING", index=True)  # PENDING | APPROVED | REJECTED | CANCELLED
    reviewer_note = Column(Text, nullable=True)

