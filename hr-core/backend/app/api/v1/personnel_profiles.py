import base64
import os
import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Any, Tuple
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, Body
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.database import get_db, engine
from app.models.base import Base
from app.api.deps import get_current_user, get_current_permissions
from app.core.exceptions import NotFoundError, BadRequestError, ForbiddenError
from app.models.user import User
from app.models.employee import Employee
from app.models.department import Department
from app.models.position import Position
from app.models.job_position import JobPosition
from app.models.personnel_profile import (
    VcProfile,
    VcTrainingRecord,
    VcWorkExperience,
    VcSalaryLog,
    VcFamilyRelation,
    VcReward,
    VcDiscipline,
    VcAnnualEvaluation,
    VcAssetDeclaration,
)
from app.schemas.personnel_profile import (
    VcProfileUpdate,
    VcProfileDetailResponse,
    VcProfileListItem,
    VcTrainingRecordResponse,
    VcWorkExperienceResponse,
    VcSalaryLogResponse,
    VcFamilyRelationResponse,
    VcRewardResponse,
    VcDisciplineResponse,
    VcAnnualEvaluationResponse,
    VcAssetDeclarationResponse,
    WordParsePreviewResponse,
    WordImportApplyRequest,
)
from app.services.word_profile_parser import parse_word_profile_bytes

router = APIRouter()
_TABLES_INITIALIZED = False

_ALTER_STATEMENTS = [
    # vc_profiles new columns for TT06/2023 & HS01-VC/BNV
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS managing_agency_name VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS using_agency_name VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS health_insurance_card_no VARCHAR(50)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS occupation_before_recruitment VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS first_socio_political_org_date VARCHAR(150)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS state_honorary_title VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS planned_position_title VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS concurrent_position VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS cpv_concurrent_position VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS main_assigned_duty VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS work_forte VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS longest_held_job VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS professional_skill_by_major VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS salary_enjoy_percent NUMERIC(5,2)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS seniority_exceed_effective_date DATE",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS concurrent_allowance NUMERIC(6,2)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS other_allowance NUMERIC(6,2)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_code VARCHAR(50)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_salary_step VARCHAR(50)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_salary_amount VARCHAR(100)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_effective_date DATE",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_enjoy_percent VARCHAR(50)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_pctnvk VARCHAR(50)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS job_position_pctnvk_date DATE",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS old_regime_work_json TEXT",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS foreign_org_relations_json TEXT",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS other_allowances_log_json TEXT",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS family_income_salary VARCHAR(200)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS family_income_other TEXT",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS housing_allocated_info VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS housing_owned_info VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS land_allocated_info VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS land_purchased_info VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS production_land_info VARCHAR(250)",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS agency_evaluation_comment TEXT",
    "ALTER TABLE vc_profiles ADD COLUMN IF NOT EXISTS self_assessment_comment TEXT",
    # Sub-tables new columns
    "ALTER TABLE vc_training_records ADD COLUMN IF NOT EXISTS training_category VARCHAR(50) DEFAULT 'CHUYEN_MON'",
    "ALTER TABLE vc_training_records ADD COLUMN IF NOT EXISTS score_result VARCHAR(50)",
    "ALTER TABLE vc_salary_logs ADD COLUMN IF NOT EXISTS from_month_year VARCHAR(50)",
    "ALTER TABLE vc_salary_logs ADD COLUMN IF NOT EXISTS to_month_year VARCHAR(50)",
    "ALTER TABLE vc_salary_logs ADD COLUMN IF NOT EXISTS position_salary_amount VARCHAR(100)",
    "ALTER TABLE vc_family_relations ADD COLUMN IF NOT EXISTS hometown VARCHAR(250)",
    "ALTER TABLE vc_rewards ADD COLUMN IF NOT EXISTS professional_rating VARCHAR(150)",
    "ALTER TABLE vc_rewards ADD COLUMN IF NOT EXISTS emulation_rating VARCHAR(150)",
    "ALTER TABLE vc_disciplines ADD COLUMN IF NOT EXISTS from_month_year VARCHAR(50)",
    "ALTER TABLE vc_disciplines ADD COLUMN IF NOT EXISTS to_month_year VARCHAR(50)",
]


async def _ensure_tables():
    global _TABLES_INITIALIZED
    if not _TABLES_INITIALIZED:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            for stmt in _ALTER_STATEMENTS:
                await conn.execute(text(stmt))
        _TABLES_INITIALIZED = True


KEY_COMPLETION_FIELDS = [
    "cccd_number",
    "official_file_code",
    "social_insurance_code",
    "tax_code",
    "birth_full_name",
    "date_of_birth",
    "gender",
    "birthplace_province",
    "hometown_province",
    "permanent_address",
    "current_address",
    "ethnicity",
    "religion",
    "personal_phone",
    "health_classification",
    "general_education_level",
    "highest_professional_degree",
    "political_theory_level",
    "state_management_level",
    "first_recruitment_date",
    "work_unit_name",
    "professional_title_name",
    "professional_title_code",
    "salary_step",
    "salary_coefficient",
]


def _calculate_completion(profile: Optional[VcProfile]) -> int:
    if not profile:
        return 0
    filled = 0
    for field in KEY_COMPLETION_FIELDS:
        val = getattr(profile, field, None)
        if val is not None and str(val).strip() != "":
            filled += 1
    return min(100, round((filled / len(KEY_COMPLETION_FIELDS)) * 100))


def _can_access_target(current_user: User, perms: dict, target_user: Optional[User], target_emp: Optional[Employee]) -> bool:
    if current_user.is_super_admin:
        return True
    if perms.get("can_manage_employees") or perms.get("can_manage_users"):
        return True
    if target_user and str(current_user.id) == str(target_user.id):
        return True
    if target_emp and current_user.employee_id and str(current_user.employee_id) == str(target_emp.id):
        return True
    return False


async def _resolve_target(db: AsyncSession, target_id: str) -> Tuple[Optional[User], Optional[Employee]]:
    """Cho phép truyền vào user_id HOẶC employee_id và tự động tìm cả User lẫn Employee liên kết"""
    try:
        target_uuid = UUID(target_id)
    except ValueError:
        raise NotFoundError(detail="Mã định danh không hợp lệ")

    u_res = await db.execute(select(User).where(User.id == target_uuid))
    target_user = u_res.scalar_one_or_none()
    target_emp: Optional[Employee] = None

    if target_user:
        if target_user.employee_id:
            e_res = await db.execute(select(Employee).where(Employee.id == target_user.employee_id))
            target_emp = e_res.scalar_one_or_none()
        return target_user, target_emp

    # Nếu không phải User.id, tìm theo Employee.id
    e_res = await db.execute(select(Employee).where(Employee.id == target_uuid))
    target_emp = e_res.scalar_one_or_none()
    if not target_emp:
        raise NotFoundError(detail="Không tìm thấy nhân sự hoặc tài khoản")

    u_by_emp = await db.execute(select(User).where(User.employee_id == target_emp.id))
    target_user = u_by_emp.scalars().first()
    return target_user, target_emp


def _profile_load_options():
    return [
        selectinload(VcProfile.training_records),
        selectinload(VcProfile.work_experiences),
        selectinload(VcProfile.salary_logs),
        selectinload(VcProfile.family_relations),
        selectinload(VcProfile.rewards),
        selectinload(VcProfile.disciplines),
        selectinload(VcProfile.annual_evaluations),
        selectinload(VcProfile.asset_declarations),
    ]


async def _get_or_init_profile(
    db: AsyncSession,
    target_user: Optional[User],
    target_emp: Optional[Employee],
) -> VcProfile:
    await _ensure_tables()
    profile: Optional[VcProfile] = None

    if target_user:
        res = await db.execute(
            select(VcProfile).where(VcProfile.user_id == target_user.id).options(*_profile_load_options())
        )
        profile = res.scalar_one_or_none()

    if not profile and target_emp:
        res_emp = await db.execute(
            select(VcProfile).where(VcProfile.employee_id == target_emp.id).options(*_profile_load_options())
        )
        profile = res_emp.scalar_one_or_none()
        if profile and target_user and not profile.user_id:
            profile.user_id = target_user.id
            await db.commit()

    if profile and target_emp and not profile.employee_id:
        profile.employee_id = target_emp.id
        await db.commit()

    if not profile:
        dept_name: Optional[str] = None
        job_pos_name: Optional[str] = None
        dept_id = target_emp.department_id if target_emp else (target_user.department_id if target_user else None)
        if dept_id:
            d_res = await db.execute(select(Department).where(Department.id == dept_id))
            d_obj = d_res.scalar_one_or_none()
            dept_name = d_obj.name if d_obj else None
        if target_emp and target_emp.job_position_id:
            jp_res = await db.execute(select(JobPosition).where(JobPosition.id == target_emp.job_position_id))
            jp_obj = jp_res.scalar_one_or_none()
            job_pos_name = jp_obj.name if jp_obj else None

        full_name = (target_emp.full_name if target_emp else (target_user.full_name if target_user else "")) or ""
        email_val = (target_emp.email if target_emp and target_emp.email else (target_user.email if target_user else None))
        is_gov = bool(email_val and email_val.endswith(".gov.vn"))

        profile = VcProfile(
            user_id=target_user.id if target_user else None,
            employee_id=target_emp.id if target_emp else None,
            birth_full_name=full_name.upper(),
            official_file_code=target_emp.employee_code if target_emp else None,
            personal_phone=target_emp.phone if target_emp else None,
            gov_email=email_val if is_gov else None,
            personal_email=None if is_gov else email_val,
            work_unit_name=dept_name,
            approved_job_position_name=job_pos_name,
            current_agency_join_date=target_emp.hire_date if target_emp else None,
            ethnicity="Kinh",
            religion="Không",
            general_education_level="12/12",
        )
        db.add(profile)
        await db.commit()

        res_reload = await db.execute(
            select(VcProfile).where(VcProfile.id == profile.id).options(*_profile_load_options())
        )
        profile = res_reload.scalar_one()

    return profile


async def _build_detail_response(
    db: AsyncSession,
    target_user: Optional[User],
    target_emp: Optional[Employee],
    profile: VcProfile,
) -> VcProfileDetailResponse:
    dept_name = None
    emp_code = target_emp.employee_code if target_emp else None
    dept_id = target_emp.department_id if target_emp else (target_user.department_id if target_user else None)
    if dept_id:
        d_res = await db.execute(select(Department).where(Department.id == dept_id))
        d_obj = d_res.scalar_one_or_none()
        dept_name = d_obj.name if d_obj else None

    data = {}
    for field in VcProfileUpdate.model_fields.keys():
        data[field] = getattr(profile, field, None)

    primary_id = str(target_user.id) if target_user else (str(target_emp.id) if target_emp else str(profile.id))
    display_name = (target_emp.full_name if target_emp else (target_user.full_name if target_user else profile.birth_full_name))
    display_username = target_user.username if target_user else (emp_code or "Chưa cấp TK")
    display_email = (target_emp.email if target_emp and target_emp.email else (target_user.email if target_user else None))

    return VcProfileDetailResponse(
        **data,
        id=str(profile.id),
        user_id=primary_id,
        employee_id=str(target_emp.id) if target_emp else None,
        username=display_username,
        account_full_name=display_name,
        account_email=display_email,
        department_name=dept_name or profile.work_unit_name,
        employee_code=emp_code or profile.official_file_code,
        completion_percent=_calculate_completion(profile),
        updated_at=profile.updated_at,
        training_records=[
            VcTrainingRecordResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                training_category=getattr(r, "training_category", None) or "CHUYEN_MON",
                school_name=r.school_name,
                major=r.major,
                from_period=r.from_period,
                to_period=r.to_period,
                training_mode=r.training_mode,
                degree_certificate=r.degree_certificate,
                graduation_year=r.graduation_year,
                score_result=getattr(r, "score_result", None),
            )
            for r in sorted(profile.training_records, key=lambda x: x.graduation_year or 0, reverse=True)
        ],
        work_experiences=[
            VcWorkExperienceResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                from_month_year=r.from_month_year,
                to_month_year=r.to_month_year,
                organization_name=r.organization_name,
                department_name=r.department_name,
                position_name=r.position_name,
                main_duties=r.main_duties,
            )
            for r in profile.work_experiences
        ],
        salary_logs=[
            VcSalaryLogResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                from_month_year=getattr(r, "from_month_year", None),
                to_month_year=getattr(r, "to_month_year", None),
                decision_date=r.decision_date,
                decision_number=r.decision_number,
                rank_code=r.rank_code,
                salary_step=r.salary_step,
                coefficient=r.coefficient,
                position_salary_amount=getattr(r, "position_salary_amount", None),
                effective_date=r.effective_date,
                reason=r.reason,
            )
            for r in sorted(profile.salary_logs, key=lambda x: x.effective_date or date.min, reverse=True)
        ],
        family_relations=[
            VcFamilyRelationResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                side_type=r.side_type,
                relationship_type=r.relationship_type,
                full_name=r.full_name,
                birth_year=r.birth_year,
                hometown=getattr(r, "hometown", None),
                occupation=r.occupation,
                workplace_or_address=r.workplace_or_address,
                residence=r.residence,
            )
            for r in profile.family_relations
        ],
        rewards=[
            VcRewardResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                reward_year=r.reward_year,
                professional_rating=getattr(r, "professional_rating", None),
                emulation_rating=getattr(r, "emulation_rating", None),
                reward_form=r.reward_form,
                decision_number=r.decision_number,
                issuing_authority=r.issuing_authority,
            )
            for r in sorted(profile.rewards, key=lambda x: x.reward_year or 0, reverse=True)
        ],
        disciplines=[
            VcDisciplineResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                from_month_year=getattr(r, "from_month_year", None),
                to_month_year=getattr(r, "to_month_year", None),
                discipline_date=r.discipline_date,
                discipline_form=r.discipline_form,
                issuing_authority=r.issuing_authority,
                effective_duration=r.effective_duration,
                reason=r.reason,
            )
            for r in profile.disciplines
        ],
        annual_evaluations=[
            VcAnnualEvaluationResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                evaluation_year=r.evaluation_year,
                rating=r.rating,
                notes=r.notes,
            )
            for r in sorted(profile.annual_evaluations, key=lambda x: x.evaluation_year or 0, reverse=True)
        ],
        asset_declarations=[
            VcAssetDeclarationResponse(
                id=str(r.id),
                profile_id=str(r.profile_id),
                declaration_year=r.declaration_year,
                declaration_type=r.declaration_type,
                file_url=r.file_url,
                file_name=r.file_name,
                disclosure_status=r.disclosure_status,
            )
            for r in sorted(profile.asset_declarations, key=lambda x: x.declaration_year or 0, reverse=True)
        ],
    )


@router.get("", response_model=list[VcProfileListItem])
async def list_personnel_profiles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    await _ensure_tables()
    can_view_all = bool(
        current_user.is_super_admin
        or perms.get("can_manage_employees")
        or perms.get("can_manage_users")
    )

    emp_query = select(Employee).where(Employee.is_active == True).order_by(Employee.full_name)
    user_query = select(User).where(User.is_active == True).order_by(User.full_name)

    if not can_view_all:
        if current_user.employee_id:
            emp_query = emp_query.where(Employee.id == current_user.employee_id)
        else:
            emp_query = emp_query.where(Employee.id == None)
        user_query = user_query.where(User.id == current_user.id)

    emps_res = await db.execute(emp_query)
    employees = emps_res.scalars().all()

    users_res = await db.execute(user_query)
    users = users_res.scalars().all()

    user_by_emp = {str(u.employee_id): u for u in users if u.employee_id}

    prof_res = await db.execute(select(VcProfile))
    profiles_all = prof_res.scalars().all()
    prof_by_user = {str(p.user_id): p for p in profiles_all if p.user_id}
    prof_by_emp = {str(p.employee_id): p for p in profiles_all if p.employee_id}

    dept_res = await db.execute(select(Department))
    dept_map = {str(d.id): d.name for d in dept_res.scalars().all()}

    pos_res = await db.execute(select(Position))
    pos_map = {str(p.id): p.name for p in pos_res.scalars().all()}

    items: list[VcProfileListItem] = []
    seen_user_ids: set[str] = set()

    # 1. Hiển thị toàn bộ danh sách Nhân sự hiện có (kèm tài khoản nếu có)
    for emp in employees:
        eid = str(emp.id)
        linked_user = user_by_emp.get(eid)
        uid = str(linked_user.id) if linked_user else eid
        if linked_user:
            seen_user_ids.add(str(linked_user.id))

        prof = prof_by_emp.get(eid) or (prof_by_user.get(str(linked_user.id)) if linked_user else None)
        dept_name = dept_map.get(str(emp.department_id)) if emp.department_id else (prof.work_unit_name if prof else None)
        pos_name = pos_map.get(str(emp.position_id)) if emp.position_id else (emp.position or (prof.leadership_position if prof else None))

        items.append(
            VcProfileListItem(
                user_id=uid,
                employee_id=eid,
                profile_id=str(prof.id) if prof else None,
                username=linked_user.username if linked_user else (emp.employee_code or "Chưa cấp TK"),
                full_name=emp.full_name,
                birth_full_name=prof.birth_full_name if prof and prof.birth_full_name else emp.full_name.upper(),
                employee_code=emp.employee_code or (prof.official_file_code if prof else None),
                department_name=dept_name,
                position_name=pos_name,
                cccd_number=prof.cccd_number if prof else None,
                official_file_code=prof.official_file_code if prof and prof.official_file_code else emp.employee_code,
                social_insurance_code=prof.social_insurance_code if prof else None,
                highest_professional_degree=prof.highest_professional_degree if prof else None,
                professional_title_name=prof.professional_title_name if prof else None,
                professional_title_code=prof.professional_title_code if prof else None,
                salary_step=prof.salary_step if prof else None,
                salary_coefficient=prof.salary_coefficient if prof else None,
                gender=prof.gender if prof else None,
                political_theory_level=prof.political_theory_level if prof else None,
                state_management_level=prof.state_management_level if prof else None,
                health_classification=prof.health_classification if prof else None,
                is_cpv_member=bool(prof and (prof.cpv_probationary_date or prof.cpv_official_date or prof.cpv_card_number)),
                portrait_url=prof.portrait_url if prof else None,
                completion_percent=_calculate_completion(prof),
                updated_at=prof.updated_at if prof else None,
            )
        )

    # 2. Hiển thị các tài khoản độc lập chưa gắn với bản ghi Employee (VD: Administrator)
    for u in users:
        uid = str(u.id)
        if uid in seen_user_ids:
            continue
        prof = prof_by_user.get(uid)
        dept_name = dept_map.get(str(u.department_id)) if u.department_id else (prof.work_unit_name if prof else "Hệ thống / Quản trị")
        pos_name = prof.leadership_position if prof and prof.leadership_position else ("Quản trị viên" if u.is_super_admin else None)

        items.append(
            VcProfileListItem(
                user_id=uid,
                employee_id=None,
                profile_id=str(prof.id) if prof else None,
                username=u.username,
                full_name=u.full_name,
                birth_full_name=prof.birth_full_name if prof and prof.birth_full_name else u.full_name.upper(),
                employee_code=prof.official_file_code if prof else None,
                department_name=dept_name,
                position_name=pos_name,
                cccd_number=prof.cccd_number if prof else None,
                official_file_code=prof.official_file_code if prof else None,
                social_insurance_code=prof.social_insurance_code if prof else None,
                highest_professional_degree=prof.highest_professional_degree if prof else None,
                professional_title_name=prof.professional_title_name if prof else None,
                professional_title_code=prof.professional_title_code if prof else None,
                salary_step=prof.salary_step if prof else None,
                salary_coefficient=prof.salary_coefficient if prof else None,
                gender=prof.gender if prof else None,
                political_theory_level=prof.political_theory_level if prof else None,
                state_management_level=prof.state_management_level if prof else None,
                health_classification=prof.health_classification if prof else None,
                is_cpv_member=bool(prof and (prof.cpv_probationary_date or prof.cpv_official_date or prof.cpv_card_number)),
                portrait_url=prof.portrait_url if prof else None,
                completion_percent=_calculate_completion(prof),
                updated_at=prof.updated_at if prof else None,
            )
        )

    return items


@router.get("/by-user/{user_id}", response_model=VcProfileDetailResponse)
async def get_personnel_profile_by_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền xem hồ sơ lý lịch của nhân sự này")

    profile = await _get_or_init_profile(db, target_user, target_emp)
    return await _build_detail_response(db, target_user, target_emp, profile)


@router.put("/by-user/{user_id}", response_model=VcProfileDetailResponse)
async def update_personnel_profile_by_user(
    user_id: str,
    body: VcProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền chỉnh sửa hồ sơ lý lịch của nhân sự này")

    profile = await _get_or_init_profile(db, target_user, target_emp)

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(profile, k, v)

    await db.commit()
    profile = await _get_or_init_profile(db, target_user, target_emp)
    return await _build_detail_response(db, target_user, target_emp, profile)


@router.post("/by-user/{user_id}/portrait")
async def upload_portrait(
    user_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Không có quyền cập nhật ảnh chân dung")

    ext = os.path.splitext(file.filename or "portrait.jpg")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise BadRequestError(detail="Chỉ hỗ trợ định dạng ảnh JPG, PNG hoặc WEBP")

    portraits_dir = os.path.join(os.getcwd(), "uploads", "portraits")
    os.makedirs(portraits_dir, exist_ok=True)
    filename = f"portrait_{user_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(portraits_dir, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    url = f"/api/v1/personnel-profiles/files/portraits/{filename}"
    profile = await _get_or_init_profile(db, target_user, target_emp)
    profile.portrait_url = url
    await db.commit()

    return {"portrait_url": url}


@router.post("/by-user/{user_id}/asset-file")
async def upload_asset_pdf(
    user_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Không có quyền tải lên bản kê khai tài sản")

    ext = os.path.splitext(file.filename or "kekhai.pdf")[1].lower()
    if ext not in [".pdf", ".doc", ".docx", ".jpg", ".png"]:
        raise BadRequestError(detail="Chỉ hỗ trợ tệp đính kèm PDF, Word hoặc hình ảnh")

    assets_dir = os.path.join(os.getcwd(), "uploads", "asset_declarations")
    os.makedirs(assets_dir, exist_ok=True)
    safe_name = f"asset_{user_id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(assets_dir, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "file_url": f"/api/v1/personnel-profiles/files/asset_declarations/{safe_name}",
        "file_name": file.filename or safe_name,
    }


@router.get("/files/{folder}/{filename}")
async def serve_profile_file(folder: str, filename: str):
    if folder not in ("portraits", "asset_declarations"):
        raise NotFoundError(detail="Thư mục không hợp lệ")
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(os.getcwd(), "uploads", folder, safe_filename)
    if not os.path.isfile(filepath):
        raise NotFoundError(detail="Không tìm thấy tệp")
    return FileResponse(filepath)


SUB_MODEL_MAP = {
    "trainings": VcTrainingRecord,
    "work-experiences": VcWorkExperience,
    "salary-logs": VcSalaryLog,
    "family-relations": VcFamilyRelation,
    "rewards": VcReward,
    "disciplines": VcDiscipline,
    "evaluations": VcAnnualEvaluation,
    "asset-declarations": VcAssetDeclaration,
}

DATE_FIELDS = {"decision_date", "effective_date", "discipline_date"}
DECIMAL_FIELDS = {"coefficient"}
INT_FIELDS = {"graduation_year", "salary_step", "birth_year", "reward_year", "evaluation_year", "declaration_year"}


def _clean_sub_payload(payload: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for k, v in payload.items():
        if k in ("id", "profile_id", "created_at", "updated_at"):
            continue
        if v == "" or v is None:
            cleaned[k] = None
            continue
        if k in DATE_FIELDS and isinstance(v, str):
            cleaned[k] = date.fromisoformat(v[:10])
        elif k in DECIMAL_FIELDS:
            cleaned[k] = Decimal(str(v))
        elif k in INT_FIELDS:
            cleaned[k] = int(v)
        else:
            cleaned[k] = v
    return cleaned


@router.post("/by-user/{user_id}/sub/{sub_type}", response_model=VcProfileDetailResponse)
async def create_sub_record(
    user_id: str,
    sub_type: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền thêm thông tin vào hồ sơ này")

    model_cls = SUB_MODEL_MAP.get(sub_type)
    if not model_cls:
        raise BadRequestError(detail=f"Danh mục con '{sub_type}' không hợp lệ")

    profile = await _get_or_init_profile(db, target_user, target_emp)
    cleaned = _clean_sub_payload(payload)
    valid_cols = {c.name for c in model_cls.__table__.columns}
    filtered = {k: v for k, v in cleaned.items() if k in valid_cols}

    record = model_cls(profile_id=profile.id, **filtered)
    db.add(record)
    await db.commit()

    profile = await _get_or_init_profile(db, target_user, target_emp)
    return await _build_detail_response(db, target_user, target_emp, profile)


@router.put("/by-user/{user_id}/sub/{sub_type}/{record_id}", response_model=VcProfileDetailResponse)
async def update_sub_record(
    user_id: str,
    sub_type: str,
    record_id: str,
    payload: dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền cập nhật thông tin này")

    model_cls = SUB_MODEL_MAP.get(sub_type)
    if not model_cls:
        raise BadRequestError(detail=f"Danh mục con '{sub_type}' không hợp lệ")

    try:
        rec_uuid = UUID(record_id)
    except ValueError:
        raise NotFoundError(detail="ID bản ghi không hợp lệ")

    rec_res = await db.execute(select(model_cls).where(model_cls.id == rec_uuid))
    record = rec_res.scalar_one_or_none()
    if not record:
        raise NotFoundError(detail="Không tìm thấy bản ghi cần cập nhật")

    cleaned = _clean_sub_payload(payload)
    valid_cols = {c.name for c in model_cls.__table__.columns}
    for k, v in cleaned.items():
        if k in valid_cols:
            setattr(record, k, v)

    await db.commit()
    profile = await _get_or_init_profile(db, target_user, target_emp)
    return await _build_detail_response(db, target_user, target_emp, profile)


@router.delete("/by-user/{user_id}/sub/{sub_type}/{record_id}", response_model=VcProfileDetailResponse)
async def delete_sub_record(
    user_id: str,
    sub_type: str,
    record_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền xoá thông tin này")

    model_cls = SUB_MODEL_MAP.get(sub_type)
    if not model_cls:
        raise BadRequestError(detail=f"Danh mục con '{sub_type}' không hợp lệ")

    try:
        rec_uuid = UUID(record_id)
    except ValueError:
        raise NotFoundError(detail="ID bản ghi không hợp lệ")

    rec_res = await db.execute(select(model_cls).where(model_cls.id == rec_uuid))
    record = rec_res.scalar_one_or_none()
    if not record:
        raise NotFoundError(detail="Không tìm thấy bản ghi cần xoá")

    await db.delete(record)
    await db.commit()

    profile = await _get_or_init_profile(db, target_user, target_emp)
    return await _build_detail_response(db, target_user, target_emp, profile)


@router.post("/by-user/{user_id}/parse-word", response_model=WordParsePreviewResponse)
async def parse_word_profile_endpoint(
    user_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    """Bóc tách dữ liệu từ file Word (.doc MHTML/HTML hoặc .docx) và trả về dữ liệu Xem trước (Preview)"""
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền import dữ liệu cho hồ sơ này")

    filename = file.filename or "ly_lich.doc"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".doc", ".docx", ".htm", ".html", ".mht", ".mhtml"):
        raise BadRequestError(detail="Chỉ hỗ trợ định dạng tệp Word (.doc, .docx)")

    file_bytes = await file.read()
    if not file_bytes:
        raise BadRequestError(detail="Tệp tải lên trống")

    try:
        parsed = parse_word_profile_bytes(file_bytes, filename)
    except Exception as exc:
        raise BadRequestError(detail=f"Không thể đọc nội dung tệp Word: {exc}")

    return WordParsePreviewResponse(**parsed)


MAIN_PROFILE_DATE_FIELDS = {
    "cccd_issue_date",
    "date_of_birth",
    "cpv_probationary_date",
    "cpv_official_date",
    "youth_union_date",
    "trade_union_date",
    "enlistment_date",
    "discharge_date",
    "first_recruitment_date",
    "current_agency_join_date",
    "probation_end_date",
    "appointment_date",
    "reappointment_date",
    "title_appointment_date",
    "title_effective_date",
    "salary_effective_date",
    "next_promotion_date",
    "seniority_exceed_effective_date",
    "job_position_effective_date",
    "job_position_pctnvk_date",
}

MAIN_PROFILE_DECIMAL_FIELDS = {
    "weight_kg",
    "salary_coefficient",
    "seniority_exceed_percent",
    "leadership_allowance",
    "occupation_seniority_allowance",
    "preferential_allowance",
    "toxic_allowance",
    "responsibility_allowance",
    "regional_allowance",
    "salary_enjoy_percent",
    "concurrent_allowance",
    "other_allowance",
}

MAIN_PROFILE_INT_FIELDS = {
    "height_cm",
    "academic_title_year",
    "salary_step",
}


@router.post("/by-user/{user_id}/apply-word-import", response_model=VcProfileDetailResponse)
async def apply_word_import_endpoint(
    user_id: str,
    body: WordImportApplyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    """Áp dụng dữ liệu đã kiểm duyệt từ bước Xem trước Word vào Hồ sơ chính & các bảng con 1-N"""
    target_user, target_emp = await _resolve_target(db, user_id)
    if not _can_access_target(current_user, perms, target_user, target_emp):
        raise ForbiddenError(detail="Bạn không có quyền cập nhật hồ sơ này")

    profile = await _get_or_init_profile(db, target_user, target_emp)
    valid_main_cols = {c.name for c in VcProfile.__table__.columns} - {"id", "user_id", "employee_id", "created_at", "updated_at"}

    # 1. Apply scalar fields
    for k, v in (body.fields or {}).items():
        if k not in valid_main_cols:
            continue
        if v is None or v == "":
            continue
        try:
            if k in MAIN_PROFILE_DATE_FIELDS and isinstance(v, str):
                setattr(profile, k, date.fromisoformat(v[:10]))
            elif k in MAIN_PROFILE_DECIMAL_FIELDS:
                setattr(profile, k, Decimal(str(v)))
            elif k in MAIN_PROFILE_INT_FIELDS:
                setattr(profile, k, int(float(str(v))))
            elif k == "birth_full_name" and isinstance(v, str):
                setattr(profile, k, v.strip().upper())
            else:
                setattr(profile, k, v)
        except Exception:
            continue

    # 2. Save portrait if extracted from Word and user doesn't have one (or wants it updated)
    if body.portrait_data_url and body.portrait_data_url.startswith("data:image/"):
        try:
            header, b64_data = body.portrait_data_url.split(",", 1)
            ext = ".png" if "png" in header else ".jpg"
            portraits_dir = os.path.join(os.getcwd(), "uploads", "portraits")
            os.makedirs(portraits_dir, exist_ok=True)
            filename = f"portrait_{user_id}_{uuid.uuid4().hex[:8]}{ext}"
            filepath = os.path.join(portraits_dir, filename)
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(b64_data))
            profile.portrait_url = f"/api/v1/personnel-profiles/files/portraits/{filename}"
        except Exception:
            pass

    overwrite = body.mode == "overwrite_subtables"

    # 3. Trainings
    if body.trainings:
        if overwrite:
            for old_r in list(profile.training_records):
                await db.delete(old_r)
            existing_keys = set()
        else:
            existing_keys = {
                (
                    (r.school_name or "").strip().lower(),
                    (r.major or "").strip().lower(),
                    (r.from_period or "").strip().lower(),
                )
                for r in profile.training_records
            }
        for item in body.trainings:
            cleaned = _clean_sub_payload(item)
            school = (cleaned.get("school_name") or "").strip()
            if not school:
                continue
            key = (
                school.lower(),
                (cleaned.get("major") or "").strip().lower(),
                (cleaned.get("from_period") or "").strip().lower(),
            )
            if key in existing_keys:
                continue
            existing_keys.add(key)
            valid_cols = {c.name for c in VcTrainingRecord.__table__.columns}
            db.add(VcTrainingRecord(profile_id=profile.id, **{k: v for k, v in cleaned.items() if k in valid_cols}))

    # 4. Work experiences
    if body.work_experiences:
        if overwrite:
            for old_r in list(profile.work_experiences):
                await db.delete(old_r)
            existing_w_keys = set()
        else:
            existing_w_keys = {
                (
                    (r.from_month_year or "").strip().lower(),
                    (r.organization_name or "").strip().lower(),
                )
                for r in profile.work_experiences
            }
        for item in body.work_experiences:
            cleaned = _clean_sub_payload(item)
            org = (cleaned.get("organization_name") or "").strip()
            from_my = (cleaned.get("from_month_year") or "-").strip()
            if not org:
                continue
            key = (from_my.lower(), org.lower())
            if key in existing_w_keys:
                continue
            existing_w_keys.add(key)
            cleaned["from_month_year"] = from_my
            valid_cols = {c.name for c in VcWorkExperience.__table__.columns}
            db.add(VcWorkExperience(profile_id=profile.id, **{k: v for k, v in cleaned.items() if k in valid_cols}))

    # 5. Family relations
    if body.family_relations:
        if overwrite:
            for old_r in list(profile.family_relations):
                await db.delete(old_r)
            existing_f_keys = set()
        else:
            existing_f_keys = {
                (
                    (r.side_type or "self").strip().lower(),
                    (r.relationship_type or "").strip().lower(),
                    (r.full_name or "").strip().lower(),
                )
                for r in profile.family_relations
            }
        for item in body.family_relations:
            cleaned = _clean_sub_payload(item)
            fname = (cleaned.get("full_name") or "").strip()
            rel_t = (cleaned.get("relationship_type") or "").strip()
            side_t = (cleaned.get("side_type") or "self").strip()
            if not fname or not rel_t:
                continue
            key = (side_t.lower(), rel_t.lower(), fname.lower())
            if key in existing_f_keys:
                continue
            existing_f_keys.add(key)
            valid_cols = {c.name for c in VcFamilyRelation.__table__.columns}
            db.add(VcFamilyRelation(profile_id=profile.id, **{k: v for k, v in cleaned.items() if k in valid_cols}))

    # 6. Salary logs
    if body.salary_logs:
        if overwrite:
            for old_r in list(profile.salary_logs):
                await db.delete(old_r)
            existing_s_keys = set()
        else:
            existing_s_keys = {
                (
                    (getattr(r, "from_month_year", None) or "").strip().lower(),
                    str(r.salary_step or ""),
                    f"{float(r.coefficient):.2f}" if r.coefficient is not None else "",
                )
                for r in profile.salary_logs
            }
        for item in body.salary_logs:
            cleaned = _clean_sub_payload(item)
            if cleaned.get("coefficient") is None:
                continue
            key = (
                (cleaned.get("from_month_year") or "").strip().lower(),
                str(cleaned.get("salary_step") or ""),
                f"{float(cleaned['coefficient']):.2f}",
            )
            if key in existing_s_keys:
                continue
            existing_s_keys.add(key)
            valid_cols = {c.name for c in VcSalaryLog.__table__.columns}
            db.add(VcSalaryLog(profile_id=profile.id, **{k: v for k, v in cleaned.items() if k in valid_cols}))

    # 7. Rewards
    if body.rewards:
        if overwrite:
            for old_r in list(profile.rewards):
                await db.delete(old_r)
        for item in body.rewards:
            cleaned = _clean_sub_payload(item)
            if not cleaned.get("reward_year") or not cleaned.get("reward_form"):
                continue
            valid_cols = {c.name for c in VcReward.__table__.columns}
            db.add(VcReward(profile_id=profile.id, **{k: v for k, v in cleaned.items() if k in valid_cols}))

    # 8. Disciplines
    if body.disciplines:
        if overwrite:
            for old_r in list(profile.disciplines):
                await db.delete(old_r)
        for item in body.disciplines:
            cleaned = _clean_sub_payload(item)
            if not cleaned.get("discipline_form"):
                continue
            valid_cols = {c.name for c in VcDiscipline.__table__.columns}
            db.add(VcDiscipline(profile_id=profile.id, **{k: v for k, v in cleaned.items() if k in valid_cols}))

    await db.commit()
    profile = await _get_or_init_profile(db, target_user, target_emp)
    return await _build_detail_response(db, target_user, target_emp, profile)
