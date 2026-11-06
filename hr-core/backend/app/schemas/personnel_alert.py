from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


class AlertActionHistoryEntry(BaseModel):
    timestamp: str
    actor_name: str
    action_type: str
    action_label: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    reason: Optional[str] = None


class PersonnelAlertItemResponse(BaseModel):
    id: str
    profile_id: str
    user_id: Optional[str] = None
    employee_id: Optional[str] = None

    # Thông tin định danh viên chức
    full_name: str
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    highest_professional_degree: Optional[str] = None
    professional_title_name: Optional[str] = None
    professional_title_code: Optional[str] = None
    portrait_url: Optional[str] = None

    # Phân loại & Thời hạn
    alert_category: str
    alert_category_label: str
    cycle_start_date: date
    standard_cycle_months: int
    base_due_date: date
    discipline_delay_months: int = 0
    discipline_details: Optional[str] = None
    early_bonus_months: int = 0
    reward_details: Optional[str] = None
    due_date: date
    days_remaining: int

    # Gia hạn xử lý hành chính & Từ chối / Lùi kỳ xét (BA v2.0)
    extended_deadline: Optional[date] = None
    extension_count: int = 0
    extension_reason: Optional[str] = None
    is_extended_active: bool = False
    rejection_reason: Optional[str] = None
    penalty_delay_months: int = 0
    action_history: List[AlertActionHistoryEntry] = []

    # Chặng cảnh báo & Hướng dẫn thao tác
    milestone_code: str          # 'T-90' | 'T-60' | 'T-30' | 'T-0' | 'EXTENDED' | 'ON_HOLD' | 'REJECTED' | 'UPCOMING' | 'COMPLETED'
    badge_color: str             # 'green' | 'gold' | 'orange' | 'red' | 'blue' | 'purple' | 'default'
    badge_text: str              # Nội dung huy hiệu trên màn hình
    action_guidance: str         # Công việc Viên chức Nhân sự cần thực hiện
    headline_message: Optional[str] = None

    # Thông tin Lương & Phụ cấp
    rank_tier: Optional[str] = None
    current_step: Optional[int] = None
    max_step: Optional[int] = None
    current_coefficient: Optional[Decimal] = None
    current_exceed_percent: Optional[Decimal] = None
    leadership_allowance: Optional[Decimal] = None

    proposed_step: Optional[int] = None
    proposed_coefficient: Optional[Decimal] = None
    proposed_exceed_percent: Optional[Decimal] = None

    # Thông tin Bổ nhiệm lại & Tuổi nghỉ hưu
    leadership_position: Optional[str] = None
    retirement_date: Optional[date] = None
    remaining_work_months: Optional[int] = None
    evaluation_summary: Optional[str] = None

    # Trạng thái xử lý & Quyết định
    workflow_status: str
    process_notes: Optional[str] = None
    decision_number: Optional[str] = None
    decision_date: Optional[date] = None
    effective_date: Optional[date] = None
    decision_file_url: Optional[str] = None
    decision_file_name: Optional[str] = None
    completed_at: Optional[datetime] = None


class PersonnelAlertKpiSummary(BaseModel):
    waiting_count: int = 0
    in_progress_count: int = 0
    overdue_or_pending_decision_count: int = 0
    completed_count: int = 0
    extended_count: int = 0
    on_hold_or_rejected_count: int = 0
    total_active_alerts: int = 0
    salary_regular_count: int = 0
    salary_exceed_count: int = 0
    salary_early_count: int = 0
    reappointment_count: int = 0
    extend_retirement_count: int = 0
    last_scanned_at: str


class PersonnelAlertDashboardResponse(BaseModel):
    summary: PersonnelAlertKpiSummary
    items: List[PersonnelAlertItemResponse]


class BatchStatusUpdateRequest(BaseModel):
    alert_ids: List[str]
    workflow_status: str
    process_notes: Optional[str] = None


class CompleteAlertDecisionRequest(BaseModel):
    decision_number: str
    decision_date: date
    effective_date: date
    new_step: Optional[int] = None
    new_coefficient: Optional[Decimal] = None
    new_exceed_percent: Optional[Decimal] = None
    new_leadership_position: Optional[str] = None
    appointment_term: Optional[str] = None
    decision_file_url: Optional[str] = None
    decision_file_name: Optional[str] = None
    process_notes: Optional[str] = None


class ExtendAlertRequest(BaseModel):
    extended_deadline: date
    extension_reason: str
    target_status: Optional[str] = None  # 'PENDING_DECISION' | 'IN_PROGRESS' | 'ON_HOLD'


class RejectAlertRequest(BaseModel):
    rejection_mode: str                  # 'DELAY_CYCLE' (Lùi kỳ xét +3/+6/+12 tháng) | 'CLOSE_REJECTED' (Đóng từ chối / Thôi chức vụ)
    penalty_delay_months: int = 6
    rejection_reason: str
    decision_number: Optional[str] = None
    decision_file_url: Optional[str] = None
    decision_file_name: Optional[str] = None


class RollbackAlertRequest(BaseModel):
    target_status: str                   # 'IN_PROGRESS' | 'WAITING' | 'ON_HOLD'
    reason: str


class PersonalProfileMapItem(BaseModel):
    id: str
    profile_id: Optional[str] = None
    user_id: Optional[str] = None
    employee_id: Optional[str] = None
    full_name: str
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    portrait_url: Optional[str] = None
    highest_professional_degree: Optional[str] = None
    political_theory_level: Optional[str] = None

    # 1. Trụ cột Viên chức (Dựa trên dữ liệu thực tế trong VcProfile & Employee)
    official_status: str                 # 'OFFICIAL_VC' | 'PROBATION_VC' | 'CONTRACT_STAFF' | 'NO_VC_PROFILE'
    official_status_label: str
    first_recruitment_date: Optional[date] = None
    current_agency_join_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    probation_days_remaining: Optional[int] = None
    professional_title_name: Optional[str] = None
    professional_title_code: Optional[str] = None
    rank_tier: Optional[str] = None

    # 2. Trụ cột Đảng viên CSVN (Dựa trên dữ liệu thực tế trong VcProfile)
    party_status: str                    # 'PARTY_OFFICIAL' | 'PARTY_PROBATION' | 'NON_PARTY'
    party_status_label: str
    cpv_probationary_date: Optional[date] = None
    cpv_official_date: Optional[date] = None
    cpv_card_number: Optional[str] = None
    cpv_current_position: Optional[str] = None
    cpv_admission_place: Optional[str] = None
    party_seniority_years: Optional[int] = None
    party_official_due_date: Optional[date] = None
    party_official_days_remaining: Optional[int] = None
    youth_union_date: Optional[date] = None
    trade_union_date: Optional[date] = None

    # 3. Trụ cột Chu kỳ Lương, Chức vụ & Hồ sơ Gần tới hạn thực tế
    salary_step: Optional[int] = None
    max_step: Optional[int] = None
    salary_coefficient: Optional[Decimal] = None
    seniority_exceed_percent: Optional[Decimal] = None
    salary_effective_date: Optional[date] = None
    salary_cycle_months: int = 36
    discipline_delay_months: int = 0
    salary_next_due_date: Optional[date] = None
    salary_days_remaining: Optional[int] = None
    salary_progress_percent: int = 0

    leadership_position: Optional[str] = None
    appointment_date: Optional[date] = None
    reappointment_due_date: Optional[date] = None
    reappointment_days_remaining: Optional[int] = None
    reappointment_progress_percent: int = 0
    retirement_date: Optional[date] = None
    remaining_work_months: Optional[int] = None

    evaluation_summary: Optional[str] = None
    has_overdue_alert: bool = False
    has_upcoming_alert: bool = False
    active_alerts_count: int = 0
    active_alerts: List[PersonnelAlertItemResponse] = []


class PersonalProfileMapSummary(BaseModel):
    total_personnel: int = 0
    official_vc_count: int = 0
    probation_vc_count: int = 0
    non_vc_or_no_profile_count: int = 0
    party_official_count: int = 0
    party_probation_count: int = 0
    non_party_count: int = 0
    with_overdue_alert_count: int = 0
    with_upcoming_alert_count: int = 0
    safe_cycle_count: int = 0


class PersonalProfileMapResponse(BaseModel):
    summary: PersonalProfileMapSummary
    items: List[PersonalProfileMapItem]
