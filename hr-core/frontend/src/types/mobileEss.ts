export interface MobileScheduleCreate {
    schedule_date: string;
    start_time: string;
    end_time: string;
    schedule_type: 'OFFICE_WORK' | 'BUSINESS_TRIP' | 'MEETING' | 'DUTY_SHIFT' | string;
    title: string;
    location?: string | null;
    notes?: string | null;
}

export interface MobileScheduleItem extends MobileScheduleCreate {
    id: string;
    status: string;
    created_at?: string | null;
}

export interface MobileLeaveRequestCreate {
    leave_type: 'ANNUAL_LEAVE' | 'PAID_PERSONAL' | 'SICK_LEAVE' | 'COMPENSATORY' | 'UNPAID_LEAVE' | string;
    start_date: string;
    end_date: string;
    session_type: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | string;
    total_days?: number;
    reason: string;
    handover_person?: string | null;
    contact_phone?: string | null;
}

export interface MobileLeaveRequestItem {
    id: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    session_type: string;
    total_days: number;
    reason: string;
    handover_person?: string | null;
    contact_phone?: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
    reviewer_note?: string | null;
    created_at?: string | null;
}

export interface MobileOvertimeCreate {
    work_date: string;
    start_time: string;
    end_time: string;
    total_hours?: number;
    day_type: 'WEEKDAY_150' | 'WEEKEND_200' | 'HOLIDAY_300' | string;
    work_location?: string | null;
    task_description: string;
}

export interface MobileOvertimeItem {
    id: string;
    work_date: string;
    start_time: string;
    end_time: string;
    total_hours: number;
    day_type: string;
    work_location?: string | null;
    task_description: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
    reviewer_note?: string | null;
    created_at?: string | null;
}

export interface MobileContractBrief {
    id: string;
    contract_number: string;
    contract_type: string;
    start_date: string;
    end_date?: string | null;
    status: string;
    job_title?: string | null;
}

export interface MobilePersonalAlertBrief {
    id: string;
    alert_category: string;
    due_date: string;
    days_remaining: number;
    workflow_status: string;
    current_step?: number | null;
    proposed_step?: number | null;
    current_coefficient?: number | null;
    proposed_coefficient?: number | null;
    leadership_position?: string | null;
}

export interface MobileSpecialistSummaryResponse {
    user_id: string;
    employee_id?: string | null;
    username: string;
    full_name: string;
    birth_full_name: string;
    official_file_code?: string | null;
    cccd_number?: string | null;
    social_insurance_code?: string | null;
    health_insurance_card_no?: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    personal_phone?: string | null;
    email?: string | null;
    portrait_url?: string | null;

    department_name?: string | null;
    position_name?: string | null;
    professional_title_name?: string | null;
    professional_title_code?: string | null;
    is_official_civil_servant: boolean;
    is_cpv_member: boolean;
    cpv_official_date?: string | null;
    highest_professional_degree?: string | null;

    salary_step?: number | null;
    salary_coefficient?: number | null;
    salary_effective_date?: string | null;
    next_promotion_date?: string | null;
    estimated_monthly_salary: number;
    profile_completion_percent: number;

    annual_leave_total_days: number;
    annual_leave_used_days: number;
    annual_leave_remaining_days: number;
    pending_leave_count: number;
    current_month_ot_hours: number;
    pending_ot_count: number;

    schedules: MobileScheduleItem[];
    leave_requests: MobileLeaveRequestItem[];
    overtime_requests: MobileOvertimeItem[];
    contracts: MobileContractBrief[];
    personal_alerts: MobilePersonalAlertBrief[];
}

