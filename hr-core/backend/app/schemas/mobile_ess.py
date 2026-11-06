from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel


class MobileScheduleCreate(BaseModel):
    schedule_date: date
    start_time: str = "07:30"
    end_time: str = "17:00"
    schedule_type: str = "OFFICE_WORK"
    title: str
    location: Optional[str] = None
    notes: Optional[str] = None


class MobileScheduleItem(MobileScheduleCreate):
    id: str
    status: str = "CONFIRMED"
    created_at: Optional[datetime] = None


class MobileLeaveRequestCreate(BaseModel):
    leave_type: str = "ANNUAL_LEAVE"
    start_date: date
    end_date: date
    session_type: str = "FULL_DAY"
    total_days: Optional[Decimal] = None
    reason: str
    handover_person: Optional[str] = None
    contact_phone: Optional[str] = None


class MobileLeaveRequestItem(BaseModel):
    id: str
    leave_type: str
    start_date: date
    end_date: date
    session_type: str
    total_days: float
    reason: str
    handover_person: Optional[str] = None
    contact_phone: Optional[str] = None
    status: str
    reviewer_note: Optional[str] = None
    created_at: Optional[datetime] = None


class MobileOvertimeCreate(BaseModel):
    work_date: date
    start_time: str = "17:30"
    end_time: str = "20:30"
    total_hours: Optional[Decimal] = None
    day_type: str = "WEEKDAY_150"
    work_location: Optional[str] = "Tại cơ quan"
    task_description: str


class MobileOvertimeItem(BaseModel):
    id: str
    work_date: date
    start_time: str
    end_time: str
    total_hours: float
    day_type: str
    work_location: Optional[str] = None
    task_description: str
    status: str
    reviewer_note: Optional[str] = None
    created_at: Optional[datetime] = None


class MobileContractBrief(BaseModel):
    id: str
    contract_number: str
    contract_type: str
    start_date: date
    end_date: Optional[date] = None
    status: str
    job_title: Optional[str] = None


class MobilePersonalAlertBrief(BaseModel):
    id: str
    alert_category: str
    due_date: date
    days_remaining: int
    workflow_status: str
    current_step: Optional[int] = None
    proposed_step: Optional[int] = None
    current_coefficient: Optional[float] = None
    proposed_coefficient: Optional[float] = None
    leadership_position: Optional[str] = None


class MobileSpecialistSummaryResponse(BaseModel):
    # Identity & Role
    user_id: str
    employee_id: Optional[str] = None
    username: str
    full_name: str
    birth_full_name: str
    official_file_code: Optional[str] = None
    cccd_number: Optional[str] = None
    social_insurance_code: Optional[str] = None
    health_insurance_card_no: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    personal_phone: Optional[str] = None
    email: Optional[str] = None
    portrait_url: Optional[str] = None

    # Organization & Official Status
    department_name: Optional[str] = None
    position_name: Optional[str] = None
    professional_title_name: Optional[str] = None
    professional_title_code: Optional[str] = None
    is_official_civil_servant: bool = False
    is_cpv_member: bool = False
    cpv_official_date: Optional[date] = None
    highest_professional_degree: Optional[str] = None

    # Salary & Allowances
    salary_step: Optional[int] = None
    salary_coefficient: Optional[float] = None
    salary_effective_date: Optional[date] = None
    next_promotion_date: Optional[date] = None
    estimated_monthly_salary: float = 0.0
    profile_completion_percent: int = 0

    # Leave & OT Quotas (Calculated from real records)
    annual_leave_total_days: float = 12.0
    annual_leave_used_days: float = 0.0
    annual_leave_remaining_days: float = 12.0
    pending_leave_count: int = 0
    current_month_ot_hours: float = 0.0
    pending_ot_count: int = 0

    # Personal Data Collections (Strictly scoped to current_user)
    schedules: List[MobileScheduleItem] = []
    leave_requests: List[MobileLeaveRequestItem] = []
    overtime_requests: List[MobileOvertimeItem] = []
    contracts: List[MobileContractBrief] = []
    personal_alerts: List[MobilePersonalAlertBrief] = []

