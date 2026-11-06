from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, field_validator


# --- Sub-tables Schemas ---

class VcTrainingRecordBase(BaseModel):
    training_category: Optional[str] = "CHUYEN_MON"
    school_name: str
    major: Optional[str] = None
    from_period: Optional[str] = None
    to_period: Optional[str] = None
    training_mode: Optional[str] = None
    degree_certificate: Optional[str] = None
    graduation_year: Optional[int] = None
    score_result: Optional[str] = None


class VcTrainingRecordResponse(VcTrainingRecordBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcWorkExperienceBase(BaseModel):
    from_month_year: str
    to_month_year: Optional[str] = None
    organization_name: str
    department_name: Optional[str] = None
    position_name: Optional[str] = None
    main_duties: Optional[str] = None


class VcWorkExperienceResponse(VcWorkExperienceBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcSalaryLogBase(BaseModel):
    from_month_year: Optional[str] = None
    to_month_year: Optional[str] = None
    decision_date: Optional[date] = None
    decision_number: Optional[str] = None
    rank_code: Optional[str] = None
    salary_step: Optional[int] = None
    coefficient: Decimal
    position_salary_amount: Optional[str] = None
    effective_date: Optional[date] = None
    reason: Optional[str] = None


class VcSalaryLogResponse(VcSalaryLogBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcFamilyRelationBase(BaseModel):
    side_type: str = "self"  # 'self' | 'spouse'
    relationship_type: str
    full_name: str
    birth_year: Optional[int] = None
    hometown: Optional[str] = None
    occupation: Optional[str] = None
    workplace_or_address: Optional[str] = None
    residence: Optional[str] = None


class VcFamilyRelationResponse(VcFamilyRelationBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcRewardBase(BaseModel):
    reward_year: int
    professional_rating: Optional[str] = None
    emulation_rating: Optional[str] = None
    reward_form: str
    decision_number: Optional[str] = None
    issuing_authority: Optional[str] = None


class VcRewardResponse(VcRewardBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcDisciplineBase(BaseModel):
    from_month_year: Optional[str] = None
    to_month_year: Optional[str] = None
    discipline_date: Optional[date] = None
    discipline_form: str
    issuing_authority: Optional[str] = None
    effective_duration: Optional[str] = None
    reason: Optional[str] = None


class VcDisciplineResponse(VcDisciplineBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcAnnualEvaluationBase(BaseModel):
    evaluation_year: int
    rating: str
    notes: Optional[str] = None


class VcAnnualEvaluationResponse(VcAnnualEvaluationBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


class VcAssetDeclarationBase(BaseModel):
    declaration_year: int
    declaration_type: Optional[str] = "Kê khai hằng năm"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    disclosure_status: Optional[str] = None


class VcAssetDeclarationResponse(VcAssetDeclarationBase):
    id: str
    profile_id: str

    class Config:
        from_attributes = True


# --- Main Profile Schemas ---

class VcProfileUpdate(BaseModel):
    # 1. Core Identity
    cccd_number: Optional[str] = None
    cccd_issue_date: Optional[date] = None
    cccd_issue_place: Optional[str] = None
    official_file_code: Optional[str] = None
    social_insurance_code: Optional[str] = None
    tax_code: Optional[str] = None

    birth_full_name: Optional[str] = None
    alias_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None

    birthplace_province: Optional[str] = None
    birthplace_district: Optional[str] = None
    birthplace_ward: Optional[str] = None

    hometown_province: Optional[str] = None
    hometown_district: Optional[str] = None
    hometown_ward: Optional[str] = None

    permanent_address: Optional[str] = None
    current_address: Optional[str] = None

    ethnicity: Optional[str] = None
    religion: Optional[str] = None
    family_background: Optional[str] = None

    personal_phone: Optional[str] = None
    work_phone: Optional[str] = None
    gov_email: Optional[str] = None
    personal_email: Optional[str] = None
    portrait_url: Optional[str] = None

    # 2. Health & Personal History
    height_cm: Optional[int] = None
    weight_kg: Optional[Decimal] = None
    blood_type: Optional[str] = None
    health_classification: Optional[str] = None
    chronic_diseases: Optional[str] = None

    wounded_soldier_class: Optional[str] = None
    policy_family_type: Optional[str] = None

    political_history_self: Optional[str] = None
    foreign_relations_history: Optional[str] = None

    # 3. Politics & Organizations
    cpv_probationary_date: Optional[date] = None
    cpv_official_date: Optional[date] = None
    cpv_card_number: Optional[str] = None
    cpv_admission_place: Optional[str] = None
    cpv_current_position: Optional[str] = None

    youth_union_date: Optional[date] = None
    trade_union_date: Optional[date] = None
    peoples_inspectorate_info: Optional[str] = None

    enlistment_date: Optional[date] = None
    discharge_date: Optional[date] = None
    highest_military_rank: Optional[str] = None

    # 4. Education & Qualifications
    general_education_level: Optional[str] = None
    highest_professional_degree: Optional[str] = None
    academic_title: Optional[str] = None
    academic_title_year: Optional[int] = None
    political_theory_level: Optional[str] = None
    state_management_level: Optional[str] = None
    it_skill_level: Optional[str] = None
    foreign_language_level: Optional[str] = None

    # 5. Recruitment, Job Position & Professional Title
    first_recruitment_date: Optional[date] = None
    recruitment_agency: Optional[str] = None
    recruitment_method: Optional[str] = None

    current_agency_join_date: Optional[date] = None
    probation_end_date: Optional[date] = None

    work_unit_name: Optional[str] = None
    approved_job_position_name: Optional[str] = None
    leadership_position: Optional[str] = None
    appointment_date: Optional[date] = None
    reappointment_date: Optional[date] = None
    appointment_term: Optional[str] = None

    professional_title_name: Optional[str] = None
    professional_title_code: Optional[str] = None
    title_appointment_date: Optional[date] = None
    title_effective_date: Optional[date] = None

    # 6. Salary & Allowances
    salary_step: Optional[int] = None
    salary_coefficient: Optional[Decimal] = None
    salary_effective_date: Optional[date] = None
    next_promotion_date: Optional[date] = None
    seniority_exceed_percent: Optional[Decimal] = None

    leadership_allowance: Optional[Decimal] = None
    occupation_seniority_allowance: Optional[Decimal] = None
    preferential_allowance: Optional[Decimal] = None
    toxic_allowance: Optional[Decimal] = None
    responsibility_allowance: Optional[Decimal] = None
    regional_allowance: Optional[Decimal] = None

    # 7. Extended Fields for 2 Official Templates (TT 06/2023/TT-BNV & HS01-VC/BNV TT 07/2019/TT-BNV)
    managing_agency_name: Optional[str] = None
    using_agency_name: Optional[str] = None
    health_insurance_card_no: Optional[str] = None
    occupation_before_recruitment: Optional[str] = None
    first_socio_political_org_date: Optional[str] = None
    state_honorary_title: Optional[str] = None
    planned_position_title: Optional[str] = None
    concurrent_position: Optional[str] = None
    cpv_concurrent_position: Optional[str] = None
    main_assigned_duty: Optional[str] = None
    work_forte: Optional[str] = None
    longest_held_job: Optional[str] = None
    professional_skill_by_major: Optional[str] = None

    salary_enjoy_percent: Optional[Decimal] = None
    seniority_exceed_effective_date: Optional[date] = None
    concurrent_allowance: Optional[Decimal] = None
    other_allowance: Optional[Decimal] = None

    job_position_code: Optional[str] = None
    job_position_salary_step: Optional[str] = None
    job_position_salary_amount: Optional[str] = None
    job_position_effective_date: Optional[date] = None
    job_position_enjoy_percent: Optional[str] = None
    job_position_pctnvk: Optional[str] = None
    job_position_pctnvk_date: Optional[date] = None

    old_regime_work_json: Optional[str] = None
    foreign_org_relations_json: Optional[str] = None
    other_allowances_log_json: Optional[str] = None

    family_income_salary: Optional[str] = None
    family_income_other: Optional[str] = None
    housing_allocated_info: Optional[str] = None
    housing_owned_info: Optional[str] = None
    land_allocated_info: Optional[str] = None
    land_purchased_info: Optional[str] = None
    production_land_info: Optional[str] = None

    agency_evaluation_comment: Optional[str] = None
    self_assessment_comment: Optional[str] = None

    @field_validator("birth_full_name")
    @classmethod
    def uppercase_birth_name(cls, v: Optional[str]) -> Optional[str]:
        if v:
            return v.strip().upper()
        return v


class WordParsePreviewResponse(BaseModel):
    template_type: str  # 'TT06_2023' | 'HS01_2019' | 'GENERAL_WORD'
    template_label: str
    file_name: str
    extracted_fields: Dict[str, Any] = {}
    extracted_trainings: List[Dict[str, Any]] = []
    extracted_work_experiences: List[Dict[str, Any]] = []
    extracted_family_relations: List[Dict[str, Any]] = []
    extracted_salary_logs: List[Dict[str, Any]] = []
    extracted_rewards: List[Dict[str, Any]] = []
    extracted_disciplines: List[Dict[str, Any]] = []
    extracted_portrait_data_url: Optional[str] = None
    warnings: List[str] = []


class WordImportApplyRequest(BaseModel):
    mode: str = "merge"  # 'merge' (Cập nhật bổ sung & chống trùng lặp) | 'overwrite_subtables' (Ghi đè các bảng con)
    fields: Dict[str, Any] = {}
    trainings: List[Dict[str, Any]] = []
    work_experiences: List[Dict[str, Any]] = []
    family_relations: List[Dict[str, Any]] = []
    salary_logs: List[Dict[str, Any]] = []
    rewards: List[Dict[str, Any]] = []
    disciplines: List[Dict[str, Any]] = []
    portrait_data_url: Optional[str] = None


class VcProfileDetailResponse(VcProfileUpdate):
    id: str
    user_id: Optional[str] = None
    employee_id: Optional[str] = None
    username: Optional[str] = None
    account_full_name: Optional[str] = None
    account_email: Optional[str] = None
    department_name: Optional[str] = None
    employee_code: Optional[str] = None
    completion_percent: int = 0
    updated_at: Optional[datetime] = None

    training_records: List[VcTrainingRecordResponse] = []
    work_experiences: List[VcWorkExperienceResponse] = []
    salary_logs: List[VcSalaryLogResponse] = []
    family_relations: List[VcFamilyRelationResponse] = []
    rewards: List[VcRewardResponse] = []
    disciplines: List[VcDisciplineResponse] = []
    annual_evaluations: List[VcAnnualEvaluationResponse] = []
    asset_declarations: List[VcAssetDeclarationResponse] = []


class VcProfileListItem(BaseModel):
    user_id: str
    employee_id: Optional[str] = None
    profile_id: Optional[str] = None
    username: str
    full_name: str
    birth_full_name: Optional[str] = None
    employee_code: Optional[str] = None
    department_name: Optional[str] = None
    position_name: Optional[str] = None
    cccd_number: Optional[str] = None
    official_file_code: Optional[str] = None
    social_insurance_code: Optional[str] = None
    highest_professional_degree: Optional[str] = None
    professional_title_name: Optional[str] = None
    professional_title_code: Optional[str] = None
    salary_step: Optional[int] = None
    salary_coefficient: Optional[Decimal] = None
    gender: Optional[str] = None
    political_theory_level: Optional[str] = None
    state_management_level: Optional[str] = None
    health_classification: Optional[str] = None
    is_cpv_member: bool = False
    portrait_url: Optional[str] = None
    completion_percent: int = 0
    updated_at: Optional[datetime] = None

