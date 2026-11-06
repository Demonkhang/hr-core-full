export interface VcTrainingRecord {
  id: string;
  profile_id: string;
  training_category?: string | null; // 'CHUYEN_MON' | 'LY_LUAN_CHINH_TRI' | 'BOI_DUONG_QLNN' | 'AN_NINH_QUOC_PHONG' | 'TIN_HOC' | 'NGOAI_NGU'
  school_name: string;
  major?: string | null;
  from_period?: string | null;
  to_period?: string | null;
  training_mode?: string | null;
  degree_certificate?: string | null;
  graduation_year?: number | null;
  score_result?: string | null;
}

export interface VcWorkExperience {
  id: string;
  profile_id: string;
  from_month_year: string;
  to_month_year?: string | null;
  organization_name: string;
  department_name?: string | null;
  position_name?: string | null;
  main_duties?: string | null;
}

export interface VcSalaryLog {
  id: string;
  profile_id: string;
  from_month_year?: string | null;
  to_month_year?: string | null;
  decision_date?: string | null;
  decision_number?: string | null;
  rank_code?: string | null;
  salary_step?: number | null;
  coefficient: number;
  position_salary_amount?: string | null;
  effective_date?: string | null;
  reason?: string | null;
}

export interface VcFamilyRelation {
  id: string;
  profile_id: string;
  side_type: 'self' | 'spouse' | string;
  relationship_type: string;
  full_name: string;
  birth_year?: number | null;
  hometown?: string | null;
  occupation?: string | null;
  workplace_or_address?: string | null;
  residence?: string | null;
}

export interface VcReward {
  id: string;
  profile_id: string;
  reward_year: number;
  professional_rating?: string | null;
  emulation_rating?: string | null;
  reward_form: string;
  decision_number?: string | null;
  issuing_authority?: string | null;
}

export interface VcDiscipline {
  id: string;
  profile_id: string;
  from_month_year?: string | null;
  to_month_year?: string | null;
  discipline_date?: string | null;
  discipline_form: string;
  issuing_authority?: string | null;
  effective_duration?: string | null;
  reason?: string | null;
}

export interface VcAnnualEvaluation {
  id: string;
  profile_id: string;
  evaluation_year: number;
  rating: string;
  notes?: string | null;
}

export interface VcAssetDeclaration {
  id: string;
  profile_id: string;
  declaration_year: number;
  declaration_type?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  disclosure_status?: string | null;
}

export interface VcProfileDetail {
  id: string;
  user_id?: string | null;
  employee_id?: string | null;
  username?: string | null;
  account_full_name?: string | null;
  account_email?: string | null;
  department_name?: string | null;
  employee_code?: string | null;
  completion_percent: number;
  updated_at?: string | null;

  // 1. Core Identity
  cccd_number?: string | null;
  cccd_issue_date?: string | null;
  cccd_issue_place?: string | null;
  official_file_code?: string | null;
  social_insurance_code?: string | null;
  tax_code?: string | null;

  birth_full_name?: string | null;
  alias_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;

  birthplace_province?: string | null;
  birthplace_district?: string | null;
  birthplace_ward?: string | null;

  hometown_province?: string | null;
  hometown_district?: string | null;
  hometown_ward?: string | null;

  permanent_address?: string | null;
  current_address?: string | null;

  ethnicity?: string | null;
  religion?: string | null;
  family_background?: string | null;

  personal_phone?: string | null;
  work_phone?: string | null;
  gov_email?: string | null;
  personal_email?: string | null;
  portrait_url?: string | null;

  // 2. Health & Personal History
  height_cm?: number | null;
  weight_kg?: number | null;
  blood_type?: string | null;
  health_classification?: string | null;
  chronic_diseases?: string | null;

  wounded_soldier_class?: string | null;
  policy_family_type?: string | null;

  political_history_self?: string | null;
  foreign_relations_history?: string | null;

  // 3. Politics & Organizations
  cpv_probationary_date?: string | null;
  cpv_official_date?: string | null;
  cpv_card_number?: string | null;
  cpv_admission_place?: string | null;
  cpv_current_position?: string | null;

  youth_union_date?: string | null;
  trade_union_date?: string | null;
  peoples_inspectorate_info?: string | null;

  enlistment_date?: string | null;
  discharge_date?: string | null;
  highest_military_rank?: string | null;

  // 4. Education & Qualifications
  general_education_level?: string | null;
  highest_professional_degree?: string | null;
  academic_title?: string | null;
  academic_title_year?: number | null;
  political_theory_level?: string | null;
  state_management_level?: string | null;
  it_skill_level?: string | null;
  foreign_language_level?: string | null;

  // 5. Recruitment, Job Position & Professional Title
  first_recruitment_date?: string | null;
  recruitment_agency?: string | null;
  recruitment_method?: string | null;

  current_agency_join_date?: string | null;
  probation_end_date?: string | null;

  work_unit_name?: string | null;
  approved_job_position_name?: string | null;
  leadership_position?: string | null;
  appointment_date?: string | null;
  reappointment_date?: string | null;
  appointment_term?: string | null;

  professional_title_name?: string | null;
  professional_title_code?: string | null;
  title_appointment_date?: string | null;
  title_effective_date?: string | null;

  // 6. Salary & Allowances
  salary_step?: number | null;
  salary_coefficient?: number | null;
  salary_effective_date?: string | null;
  next_promotion_date?: string | null;
  seniority_exceed_percent?: number | null;

  leadership_allowance?: number | null;
  occupation_seniority_allowance?: number | null;
  preferential_allowance?: number | null;
  toxic_allowance?: number | null;
  responsibility_allowance?: number | null;
  regional_allowance?: number | null;

  // Extended Fields for 2 Official Templates (TT 06/2023/TT-BNV & HS01-VC/BNV TT 07/2019/TT-BNV)
  managing_agency_name?: string | null;
  using_agency_name?: string | null;
  health_insurance_card_no?: string | null;
  occupation_before_recruitment?: string | null;
  first_socio_political_org_date?: string | null;
  state_honorary_title?: string | null;
  planned_position_title?: string | null;
  concurrent_position?: string | null;
  cpv_concurrent_position?: string | null;
  main_assigned_duty?: string | null;
  work_forte?: string | null;
  longest_held_job?: string | null;
  professional_skill_by_major?: string | null;

  salary_enjoy_percent?: number | null;
  seniority_exceed_effective_date?: string | null;
  concurrent_allowance?: number | null;
  other_allowance?: number | null;

  job_position_code?: string | null;
  job_position_salary_step?: string | null;
  job_position_salary_amount?: string | null;
  job_position_effective_date?: string | null;
  job_position_enjoy_percent?: string | null;
  job_position_pctnvk?: string | null;
  job_position_pctnvk_date?: string | null;

  old_regime_work_json?: string | null;
  foreign_org_relations_json?: string | null;
  other_allowances_log_json?: string | null;

  family_income_salary?: string | null;
  family_income_other?: string | null;
  housing_allocated_info?: string | null;
  housing_owned_info?: string | null;
  land_allocated_info?: string | null;
  land_purchased_info?: string | null;
  production_land_info?: string | null;

  agency_evaluation_comment?: string | null;
  self_assessment_comment?: string | null;

  // 7. Sub-tables
  training_records: VcTrainingRecord[];
  work_experiences: VcWorkExperience[];
  salary_logs: VcSalaryLog[];
  family_relations: VcFamilyRelation[];
  rewards: VcReward[];
  disciplines: VcDiscipline[];
  annual_evaluations: VcAnnualEvaluation[];
  asset_declarations: VcAssetDeclaration[];
}

export interface WordParsePreview {
  template_type: 'TT06_2023' | 'HS01_2019' | 'GENERAL_WORD' | string;
  template_label: string;
  file_name: string;
  extracted_fields: Record<string, any>;
  extracted_trainings: Record<string, any>[];
  extracted_work_experiences: Record<string, any>[];
  extracted_family_relations: Record<string, any>[];
  extracted_salary_logs: Record<string, any>[];
  extracted_rewards: Record<string, any>[];
  extracted_disciplines: Record<string, any>[];
  extracted_portrait_data_url?: string | null;
  warnings: string[];
}

export interface WordImportApplyPayload {
  mode: 'merge' | 'overwrite_subtables';
  fields: Record<string, any>;
  trainings: Record<string, any>[];
  work_experiences: Record<string, any>[];
  family_relations: Record<string, any>[];
  salary_logs: Record<string, any>[];
  rewards: Record<string, any>[];
  disciplines: Record<string, any>[];
  portrait_data_url?: string | null;
}

export interface VcProfileListItem {
  user_id: string;
  employee_id?: string | null;
  profile_id?: string | null;
  username: string;
  full_name: string;
  birth_full_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  position_name?: string | null;
  cccd_number?: string | null;
  official_file_code?: string | null;
  social_insurance_code?: string | null;
  highest_professional_degree?: string | null;
  professional_title_name?: string | null;
  professional_title_code?: string | null;
  salary_step?: number | null;
  salary_coefficient?: number | null;
  gender?: string | null;
  political_theory_level?: string | null;
  state_management_level?: string | null;
  health_classification?: string | null;
  is_cpv_member: boolean;
  portrait_url?: string | null;
  completion_percent: number;
  updated_at?: string | null;
}

export type SubRecordType =
  | 'trainings'
  | 'work-experiences'
  | 'salary-logs'
  | 'family-relations'
  | 'rewards'
  | 'disciplines'
  | 'evaluations'
  | 'asset-declarations';

