from sqlalchemy import Column, String, Integer, Numeric, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class VcProfile(Base, UUIDMixin, TimestampMixin):
    """Hồ sơ lý lịch viên chức (Mẫu HS02-VC/BNV) liên kết 1-1 với tài khoản / nhân viên"""
    __tablename__ = "vc_profiles"

    user_id = Column(ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)
    employee_id = Column(ForeignKey("employees.id", ondelete="SET NULL"), unique=True, nullable=True, index=True)

    # 1. Nhóm định danh & Thông tin nhân thân (Core Identity)
    cccd_number = Column(String(20), nullable=True, index=True)
    cccd_issue_date = Column(Date, nullable=True)
    cccd_issue_place = Column(String(200), nullable=True)
    official_file_code = Column(String(50), nullable=True, index=True)
    social_insurance_code = Column(String(30), nullable=True)
    tax_code = Column(String(30), nullable=True)

    birth_full_name = Column(String(150), nullable=True)
    alias_name = Column(String(150), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)

    birthplace_province = Column(String(100), nullable=True)
    birthplace_district = Column(String(100), nullable=True)
    birthplace_ward = Column(String(100), nullable=True)

    hometown_province = Column(String(100), nullable=True)
    hometown_district = Column(String(100), nullable=True)
    hometown_ward = Column(String(100), nullable=True)

    permanent_address = Column(Text, nullable=True)
    current_address = Column(Text, nullable=True)

    ethnicity = Column(String(50), nullable=True)
    religion = Column(String(50), nullable=True)
    family_background = Column(String(150), nullable=True)

    personal_phone = Column(String(30), nullable=True)
    work_phone = Column(String(30), nullable=True)
    gov_email = Column(String(150), nullable=True)
    personal_email = Column(String(150), nullable=True)
    portrait_url = Column(String(500), nullable=True)

    # 2. Nhóm tình trạng sức khỏe & Lịch sử bản thân
    height_cm = Column(Integer, nullable=True)
    weight_kg = Column(Numeric(5, 1), nullable=True)
    blood_type = Column(String(20), nullable=True)
    health_classification = Column(String(50), nullable=True)
    chronic_diseases = Column(Text, nullable=True)

    wounded_soldier_class = Column(String(100), nullable=True)
    policy_family_type = Column(String(200), nullable=True)

    political_history_self = Column(Text, nullable=True)
    foreign_relations_history = Column(Text, nullable=True)

    # 3. Nhóm chính trị, Đoàn thể
    cpv_probationary_date = Column(Date, nullable=True)
    cpv_official_date = Column(Date, nullable=True)
    cpv_card_number = Column(String(50), nullable=True)
    cpv_admission_place = Column(String(200), nullable=True)
    cpv_current_position = Column(String(150), nullable=True)

    youth_union_date = Column(Date, nullable=True)
    trade_union_date = Column(Date, nullable=True)
    peoples_inspectorate_info = Column(String(250), nullable=True)

    enlistment_date = Column(Date, nullable=True)
    discharge_date = Column(Date, nullable=True)
    highest_military_rank = Column(String(150), nullable=True)

    # 4. Nhóm Trình độ, Chuyên môn & Đào tạo
    general_education_level = Column(String(50), nullable=True)
    highest_professional_degree = Column(String(100), nullable=True)
    academic_title = Column(String(150), nullable=True)
    academic_title_year = Column(Integer, nullable=True)
    political_theory_level = Column(String(100), nullable=True)
    state_management_level = Column(String(150), nullable=True)
    it_skill_level = Column(String(200), nullable=True)
    foreign_language_level = Column(String(250), nullable=True)

    # 5. Nhóm Tuyển dụng, Vị trí việc làm & Ngạch/Hạng chức danh
    first_recruitment_date = Column(Date, nullable=True)
    recruitment_agency = Column(String(250), nullable=True)
    recruitment_method = Column(String(100), nullable=True)

    current_agency_join_date = Column(Date, nullable=True)
    probation_end_date = Column(Date, nullable=True)

    work_unit_name = Column(String(250), nullable=True)
    approved_job_position_name = Column(String(250), nullable=True)
    leadership_position = Column(String(200), nullable=True)
    appointment_date = Column(Date, nullable=True)
    reappointment_date = Column(Date, nullable=True)
    appointment_term = Column(String(100), nullable=True)

    professional_title_name = Column(String(200), nullable=True)
    professional_title_code = Column(String(50), nullable=True)
    title_appointment_date = Column(Date, nullable=True)
    title_effective_date = Column(Date, nullable=True)

    # 6. Nhóm Tiền lương, Phụ cấp & Chế độ đãi ngộ
    salary_step = Column(Integer, nullable=True)
    salary_coefficient = Column(Numeric(6, 2), nullable=True)
    salary_effective_date = Column(Date, nullable=True)
    next_promotion_date = Column(Date, nullable=True)
    seniority_exceed_percent = Column(Numeric(6, 2), nullable=True)

    leadership_allowance = Column(Numeric(6, 2), nullable=True)
    occupation_seniority_allowance = Column(Numeric(6, 2), nullable=True)
    preferential_allowance = Column(Numeric(6, 2), nullable=True)
    toxic_allowance = Column(Numeric(6, 2), nullable=True)
    responsibility_allowance = Column(Numeric(6, 2), nullable=True)
    regional_allowance = Column(Numeric(6, 2), nullable=True)

    # 7. Các trường mở rộng chuẩn 2 Biểu mẫu (TT 06/2023/TT-BNV & Mẫu HS01-VC/BNV TT 07/2019/TT-BNV)
    managing_agency_name = Column(String(250), nullable=True)
    using_agency_name = Column(String(250), nullable=True)
    health_insurance_card_no = Column(String(50), nullable=True)
    occupation_before_recruitment = Column(String(200), nullable=True)
    first_socio_political_org_date = Column(String(150), nullable=True)
    state_honorary_title = Column(String(200), nullable=True)
    planned_position_title = Column(String(200), nullable=True)
    concurrent_position = Column(String(200), nullable=True)
    cpv_concurrent_position = Column(String(200), nullable=True)
    main_assigned_duty = Column(String(250), nullable=True)
    work_forte = Column(String(250), nullable=True)
    longest_held_job = Column(String(250), nullable=True)
    professional_skill_by_major = Column(String(200), nullable=True)

    # Mục 30.1, 30.2, 30.3 (TT 06/2023/TT-BNV)
    salary_enjoy_percent = Column(Numeric(5, 2), nullable=True)
    seniority_exceed_effective_date = Column(Date, nullable=True)
    concurrent_allowance = Column(Numeric(6, 2), nullable=True)
    other_allowance = Column(Numeric(6, 2), nullable=True)

    job_position_code = Column(String(50), nullable=True)
    job_position_salary_step = Column(String(50), nullable=True)
    job_position_salary_amount = Column(String(100), nullable=True)
    job_position_effective_date = Column(Date, nullable=True)
    job_position_enjoy_percent = Column(String(50), nullable=True)
    job_position_pctnvk = Column(String(50), nullable=True)
    job_position_pctnvk_date = Column(Date, nullable=True)

    # Mục 34.2, 34.3, 37.2, 37.3, 38 (TT 06/2023) & Phần VII (HS01-VC/BNV)
    old_regime_work_json = Column(Text, nullable=True)
    foreign_org_relations_json = Column(Text, nullable=True)
    other_allowances_log_json = Column(Text, nullable=True)

    family_income_salary = Column(String(200), nullable=True)
    family_income_other = Column(Text, nullable=True)
    housing_allocated_info = Column(String(250), nullable=True)
    housing_owned_info = Column(String(250), nullable=True)
    land_allocated_info = Column(String(250), nullable=True)
    land_purchased_info = Column(String(250), nullable=True)
    production_land_info = Column(String(250), nullable=True)

    agency_evaluation_comment = Column(Text, nullable=True)
    self_assessment_comment = Column(Text, nullable=True)

    # Relationships 1-N (Nhóm 4 & Nhóm 7)
    training_records = relationship("VcTrainingRecord", back_populates="profile", cascade="all, delete-orphan")
    work_experiences = relationship("VcWorkExperience", back_populates="profile", cascade="all, delete-orphan")
    salary_logs = relationship("VcSalaryLog", back_populates="profile", cascade="all, delete-orphan")
    family_relations = relationship("VcFamilyRelation", back_populates="profile", cascade="all, delete-orphan")
    rewards = relationship("VcReward", back_populates="profile", cascade="all, delete-orphan")
    disciplines = relationship("VcDiscipline", back_populates="profile", cascade="all, delete-orphan")
    annual_evaluations = relationship("VcAnnualEvaluation", back_populates="profile", cascade="all, delete-orphan")
    asset_declarations = relationship("VcAssetDeclaration", back_populates="profile", cascade="all, delete-orphan")


class VcTrainingRecord(Base, UUIDMixin, TimestampMixin):
    """Bảng liên kết quá trình đào tạo chuyên môn, nghiệp vụ (Mục 32.1 -> 32.6 TT06 & Phần II HS01)"""
    __tablename__ = "vc_training_records"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    training_category = Column(String(50), nullable=True, default="CHUYEN_MON")  # CHUYEN_MON | LY_LUAN_CHINH_TRI | BOI_DUONG_QLNN | AN_NINH_QUOC_PHONG | TIN_HOC | NGOAI_NGU
    school_name = Column(String(250), nullable=False)
    major = Column(String(200), nullable=True)
    from_period = Column(String(50), nullable=True)
    to_period = Column(String(50), nullable=True)
    training_mode = Column(String(100), nullable=True)
    degree_certificate = Column(String(150), nullable=True)
    graduation_year = Column(Integer, nullable=True)
    score_result = Column(String(50), nullable=True)

    profile = relationship("VcProfile", back_populates="training_records")


class VcWorkExperience(Base, UUIDMixin, TimestampMixin):
    """Quá trình công tác"""
    __tablename__ = "vc_work_experiences"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    from_month_year = Column(String(50), nullable=False)
    to_month_year = Column(String(50), nullable=True)
    organization_name = Column(String(250), nullable=False)
    department_name = Column(String(200), nullable=True)
    position_name = Column(String(150), nullable=True)
    main_duties = Column(Text, nullable=True)

    profile = relationship("VcProfile", back_populates="work_experiences")


class VcSalaryLog(Base, UUIDMixin, TimestampMixin):
    """Quá trình lương viên chức"""
    __tablename__ = "vc_salary_logs"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    from_month_year = Column(String(50), nullable=True)
    to_month_year = Column(String(50), nullable=True)
    decision_date = Column(Date, nullable=True)
    decision_number = Column(String(100), nullable=True)
    rank_code = Column(String(100), nullable=True)
    salary_step = Column(Integer, nullable=True)
    coefficient = Column(Numeric(6, 2), nullable=False)
    position_salary_amount = Column(String(100), nullable=True)
    effective_date = Column(Date, nullable=True)
    reason = Column(String(200), nullable=True)

    profile = relationship("VcProfile", back_populates="salary_logs")


class VcFamilyRelation(Base, UUIDMixin, TimestampMixin):
    """Quan hệ gia đình (Bản thân & Bên Vợ/Chồng)"""
    __tablename__ = "vc_family_relations"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    side_type = Column(String(20), nullable=False, default="self")  # 'self' | 'spouse'
    relationship_type = Column(String(100), nullable=False)
    full_name = Column(String(150), nullable=False)
    birth_year = Column(Integer, nullable=True)
    hometown = Column(String(250), nullable=True)
    occupation = Column(String(200), nullable=True)
    workplace_or_address = Column(Text, nullable=True)
    residence = Column(Text, nullable=True)

    profile = relationship("VcProfile", back_populates="family_relations")


class VcReward(Base, UUIDMixin, TimestampMixin):
    """Quá trình Khen thưởng"""
    __tablename__ = "vc_rewards"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    reward_year = Column(Integer, nullable=False)
    professional_rating = Column(String(150), nullable=True)
    emulation_rating = Column(String(150), nullable=True)
    reward_form = Column(String(200), nullable=False)
    decision_number = Column(String(100), nullable=True)
    issuing_authority = Column(String(200), nullable=True)

    profile = relationship("VcProfile", back_populates="rewards")


class VcDiscipline(Base, UUIDMixin, TimestampMixin):
    """Quá trình Kỷ luật"""
    __tablename__ = "vc_disciplines"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    from_month_year = Column(String(50), nullable=True)
    to_month_year = Column(String(50), nullable=True)
    discipline_date = Column(Date, nullable=True)
    discipline_form = Column(String(200), nullable=False)
    issuing_authority = Column(String(200), nullable=True)
    effective_duration = Column(String(150), nullable=True)
    reason = Column(Text, nullable=True)

    profile = relationship("VcProfile", back_populates="disciplines")


class VcAnnualEvaluation(Base, UUIDMixin, TimestampMixin):
    """Đánh giá, xếp loại hàng năm"""
    __tablename__ = "vc_annual_evaluations"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    evaluation_year = Column(Integer, nullable=False)
    rating = Column(String(150), nullable=False)
    notes = Column(Text, nullable=True)

    profile = relationship("VcProfile", back_populates="annual_evaluations")


class VcAssetDeclaration(Base, UUIDMixin, TimestampMixin):
    """Kê khai tài sản, thu nhập"""
    __tablename__ = "vc_asset_declarations"

    profile_id = Column(ForeignKey("vc_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    declaration_year = Column(Integer, nullable=False)
    declaration_type = Column(String(150), nullable=True, default="Kê khai hằng năm")
    file_url = Column(String(500), nullable=True)
    file_name = Column(String(250), nullable=True)
    disclosure_status = Column(String(150), nullable=True)

    profile = relationship("VcProfile", back_populates="asset_declarations")

