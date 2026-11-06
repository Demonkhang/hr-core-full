from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class AlertCategory:
    SALARY_REGULAR = "SALARY_REGULAR"                 # Nâng bậc lương thường xuyên
    SALARY_EXCEED = "SALARY_EXCEED"                   # Phụ cấp thâm niên vượt khung (5%, +1%/năm)
    SALARY_EARLY = "SALARY_EARLY"                     # Nâng bậc lương trước thời hạn
    REAPPOINTMENT = "REAPPOINTMENT"                   # Bổ nhiệm lại chức vụ quản lý (còn >= 18 tháng công tác)
    EXTEND_TO_RETIREMENT = "EXTEND_TO_RETIREMENT"     # Kéo dài thời gian giữ chức vụ đến tuổi nghỉ hưu (< 18 tháng)


class AlertWorkflowStatus:
    WAITING = "WAITING"                     # 1. Chờ xử lý (Hệ thống báo)
    IN_PROGRESS = "IN_PROGRESS"             # 2. Đang lập hồ sơ (Đã đưa vào danh sách / Đã phát thông báo)
    PENDING_DECISION = "PENDING_DECISION"   # 3. Chờ ban hành QĐ (Đã họp Hội đồng xong)
    COMPLETED = "COMPLETED"                 # 4. Hoàn thành (Đã duyệt & nhập số QĐ mới)
    ON_HOLD = "ON_HOLD"                     # Tạm hoãn xét duyệt (Đang thanh tra / Xem xét kỷ luật / Đi học)
    REJECTED = "REJECTED"                   # Đã từ chối ban hành / Không bổ nhiệm lại


class VcPersonnelAlert(Base, UUIDMixin, TimestampMixin):
    """Bảng theo dõi trạng thái xử lý Cảnh báo Nâng bậc lương & Bổ nhiệm lại (Độc lập với Core cũ)"""
    __tablename__ = "vc_personnel_alerts"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_category = Column(String(40), nullable=False, index=True)
    cycle_start_date = Column(Date, nullable=False, index=True)

    # Thông tin tính toán thời hạn
    standard_cycle_months = Column(Integer, nullable=False, default=36)
    base_due_date = Column(Date, nullable=False)
    discipline_delay_months = Column(Integer, nullable=False, default=0)
    discipline_details = Column(Text, nullable=True)
    early_bonus_months = Column(Integer, nullable=False, default=0)
    reward_details = Column(Text, nullable=True)
    due_date = Column(Date, nullable=False, index=True)

    # Thông tin Gia hạn xử lý hành chính & Từ chối / Lùi kỳ xét (BA v2.0)
    extended_deadline = Column(Date, nullable=True)
    extension_count = Column(Integer, nullable=False, default=0)
    extension_reason = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    penalty_delay_months = Column(Integer, nullable=False, default=0)
    is_manually_adjusted = Column(Integer, nullable=False, default=0)
    action_history_json = Column(Text, nullable=True)

    # Thông tin lương / chức vụ hiện tại & đề xuất
    rank_tier = Column(String(30), nullable=True)           # 'Hạng I', 'Hạng II', 'Hạng III', 'Hạng IV'
    current_step = Column(Integer, nullable=True)
    max_step = Column(Integer, nullable=True)
    current_coefficient = Column(Numeric(6, 2), nullable=True)
    current_exceed_percent = Column(Numeric(6, 2), nullable=True)

    proposed_step = Column(Integer, nullable=True)
    proposed_coefficient = Column(Numeric(6, 2), nullable=True)
    proposed_exceed_percent = Column(Numeric(6, 2), nullable=True)

    # Thông tin bổ nhiệm lại & tuổi nghỉ hưu
    leadership_position = Column(String(200), nullable=True)
    retirement_date = Column(Date, nullable=True)
    remaining_work_months = Column(Integer, nullable=True)
    evaluation_summary = Column(Text, nullable=True)

    # Trạng thái xử lý (WAITING -> IN_PROGRESS -> PENDING_DECISION -> COMPLETED | ON_HOLD | REJECTED)
    workflow_status = Column(String(30), nullable=False, default=AlertWorkflowStatus.WAITING, index=True)
    process_notes = Column(Text, nullable=True)

    # Thông tin Quyết định khi hoàn tất
    decision_number = Column(String(100), nullable=True)
    decision_date = Column(Date, nullable=True)
    effective_date = Column(Date, nullable=True)
    decision_file_url = Column(String(500), nullable=True)
    decision_file_name = Column(String(250), nullable=True)
    completed_at = Column(DateTime, nullable=True)

    profile = relationship("VcProfile")
