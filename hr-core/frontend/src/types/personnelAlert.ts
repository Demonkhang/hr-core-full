export type AlertCategoryType =
  | 'SALARY_REGULAR'
  | 'SALARY_EXCEED'
  | 'SALARY_EARLY'
  | 'REAPPOINTMENT'
  | 'EXTEND_TO_RETIREMENT';

export type AlertWorkflowStatusType =
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'PENDING_DECISION'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'REJECTED';

export interface AlertActionHistoryEntry {
  timestamp: string;
  actor_name: string;
  action_type: string;
  action_label: string;
  from_status?: string | null;
  to_status?: string | null;
  reason?: string | null;
}

export interface PersonnelAlertItem {
  id: string;
  profile_id: string;
  user_id?: string | null;
  employee_id?: string | null;

  full_name: string;
  employee_code?: string | null;
  department_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  highest_professional_degree?: string | null;
  professional_title_name?: string | null;
  professional_title_code?: string | null;
  portrait_url?: string | null;

  alert_category: AlertCategoryType;
  alert_category_label: string;
  cycle_start_date: string;
  standard_cycle_months: number;
  base_due_date: string;
  discipline_delay_months: number;
  discipline_details?: string | null;
  early_bonus_months: number;
  reward_details?: string | null;
  due_date: string;
  days_remaining: number;

  // BA v2.0: Gia hạn xử lý, Từ chối & Nhật ký vết xử lý
  extended_deadline?: string | null;
  extension_count: number;
  extension_reason?: string | null;
  is_extended_active: boolean;
  rejection_reason?: string | null;
  penalty_delay_months: number;
  action_history: AlertActionHistoryEntry[];

  milestone_code:
    | 'T-90'
    | 'T-60'
    | 'T-30'
    | 'T-0'
    | 'EXTENDED'
    | 'ON_HOLD'
    | 'REJECTED'
    | 'UPCOMING'
    | 'COMPLETED';
  badge_color: string;
  badge_text: string;
  action_guidance: string;
  headline_message?: string | null;

  rank_tier?: string | null;
  current_step?: number | null;
  max_step?: number | null;
  current_coefficient?: number | string | null;
  current_exceed_percent?: number | string | null;
  leadership_allowance?: number | string | null;

  proposed_step?: number | null;
  proposed_coefficient?: number | string | null;
  proposed_exceed_percent?: number | string | null;

  leadership_position?: string | null;
  retirement_date?: string | null;
  remaining_work_months?: number | null;
  evaluation_summary?: string | null;

  workflow_status: AlertWorkflowStatusType;
  process_notes?: string | null;
  decision_number?: string | null;
  decision_date?: string | null;
  effective_date?: string | null;
  decision_file_url?: string | null;
  decision_file_name?: string | null;
  completed_at?: string | null;
}

export interface PersonnelAlertKpiSummary {
  waiting_count: number;
  in_progress_count: number;
  overdue_or_pending_decision_count: number;
  completed_count: number;
  extended_count: number;
  on_hold_or_rejected_count: number;
  total_active_alerts: number;
  salary_regular_count: number;
  salary_exceed_count: number;
  salary_early_count: number;
  reappointment_count: number;
  extend_retirement_count: number;
  last_scanned_at: string;
}

export interface PersonnelAlertDashboardResponse {
  summary: PersonnelAlertKpiSummary;
  items: PersonnelAlertItem[];
}

export interface CompleteAlertDecisionPayload {
  decision_number: string;
  decision_date: string;
  effective_date: string;
  new_step?: number | null;
  new_coefficient?: number | null;
  new_exceed_percent?: number | null;
  new_leadership_position?: string | null;
  appointment_term?: string | null;
  decision_file_url?: string | null;
  decision_file_name?: string | null;
  process_notes?: string | null;
}

export interface ExtendAlertPayload {
  extended_deadline: string;
  extension_reason: string;
  target_status?: AlertWorkflowStatusType;
}

export interface RejectAlertPayload {
  rejection_mode: 'DELAY_CYCLE' | 'CLOSE_REJECTED';
  penalty_delay_months?: number;
  rejection_reason: string;
  decision_number?: string | null;
  decision_file_url?: string | null;
  decision_file_name?: string | null;
}

export interface RollbackAlertPayload {
  target_status: AlertWorkflowStatusType;
  reason: string;
}

export type OfficialStatusType =
  | 'OFFICIAL_VC'
  | 'PROBATION_VC'
  | 'CONTRACT_STAFF'
  | 'NO_VC_PROFILE';

export type PartyStatusType = 'PARTY_OFFICIAL' | 'PARTY_PROBATION' | 'NON_PARTY';

export interface PersonalProfileMapItem {
  id: string;
  profile_id?: string | null;
  user_id?: string | null;
  employee_id?: string | null;
  full_name: string;
  employee_code?: string | null;
  department_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  portrait_url?: string | null;
  highest_professional_degree?: string | null;
  political_theory_level?: string | null;

  // 1. Trụ cột Viên chức (Dựa trên dữ liệu thực tế hiện có)
  official_status: OfficialStatusType;
  official_status_label: string;
  first_recruitment_date?: string | null;
  current_agency_join_date?: string | null;
  probation_end_date?: string | null;
  probation_days_remaining?: number | null;
  professional_title_name?: string | null;
  professional_title_code?: string | null;
  rank_tier?: string | null;

  // 2. Trụ cột Đảng viên CSVN (Dựa trên dữ liệu thực tế hiện có)
  party_status: PartyStatusType;
  party_status_label: string;
  cpv_probationary_date?: string | null;
  cpv_official_date?: string | null;
  cpv_card_number?: string | null;
  cpv_current_position?: string | null;
  cpv_admission_place?: string | null;
  party_seniority_years?: number | null;
  party_official_due_date?: string | null;
  party_official_days_remaining?: number | null;
  youth_union_date?: string | null;
  trade_union_date?: string | null;

  // 3. Trụ cột Chu kỳ Lương, Nhiệm kỳ & Hồ sơ Gần tới hạn thực tế
  salary_step?: number | null;
  max_step?: number | null;
  salary_coefficient?: number | string | null;
  seniority_exceed_percent?: number | string | null;
  salary_effective_date?: string | null;
  salary_cycle_months: number;
  discipline_delay_months: number;
  salary_next_due_date?: string | null;
  salary_days_remaining?: number | null;
  salary_progress_percent: number;

  leadership_position?: string | null;
  appointment_date?: string | null;
  reappointment_due_date?: string | null;
  reappointment_days_remaining?: number | null;
  reappointment_progress_percent: number;
  retirement_date?: string | null;
  remaining_work_months?: number | null;

  evaluation_summary?: string | null;
  has_overdue_alert: boolean;
  has_upcoming_alert: boolean;
  active_alerts_count: number;
  active_alerts: PersonnelAlertItem[];
}

export interface PersonalProfileMapSummary {
  total_personnel: number;
  official_vc_count: number;
  probation_vc_count: number;
  non_vc_or_no_profile_count: number;
  party_official_count: number;
  party_probation_count: number;
  non_party_count: number;
  with_overdue_alert_count: number;
  with_upcoming_alert_count: number;
  safe_cycle_count: number;
}

export interface PersonalProfileMapResponse {
  summary: PersonalProfileMapSummary;
  items: PersonalProfileMapItem[];
}
