import os
import uuid
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError, BadRequestError
from app.database import get_db, engine
from app.models.base import Base
from app.models.user import User
from app.models.personnel_profile import (
    VcProfile,
    VcSalaryLog,
    VcWorkExperience,
)
from app.models.personnel_alert import (
    VcPersonnelAlert,
    AlertCategory,
    AlertWorkflowStatus,
)
from app.schemas.personnel_alert import (
    PersonnelAlertDashboardResponse,
    PersonalProfileMapResponse,
    BatchStatusUpdateRequest,
    CompleteAlertDecisionRequest,
    ExtendAlertRequest,
    RejectAlertRequest,
    RollbackAlertRequest,
)
from app.services.personnel_alert_service import (
    build_alert_dashboard,
    build_personal_profile_map,
    scan_and_sync_alerts,
    add_months,
    detect_rank_tier_and_cycle,
    append_action_history,
)

router = APIRouter()
_ALERT_TABLES_INITIALIZED = False


async def _ensure_alert_tables():
    global _ALERT_TABLES_INITIALIZED
    if not _ALERT_TABLES_INITIALIZED:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            # Safe auto-migration cho các cột BA v2.0 (nếu bảng đã được tạo từ phiên bản v1)
            alter_statements = [
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS extended_deadline DATE;",
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS extension_count INTEGER NOT NULL DEFAULT 0;",
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS extension_reason TEXT;",
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;",
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS penalty_delay_months INTEGER NOT NULL DEFAULT 0;",
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS is_manually_adjusted INTEGER NOT NULL DEFAULT 0;",
                "ALTER TABLE vc_personnel_alerts ADD COLUMN IF NOT EXISTS action_history_json TEXT;",
            ]
            for stmt in alter_statements:
                try:
                    await conn.execute(text(stmt))
                except Exception:
                    pass
        _ALERT_TABLES_INITIALIZED = True


@router.get("", response_model=PersonnelAlertDashboardResponse)
async def list_personnel_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_alert_tables()
    return await build_alert_dashboard(db)


@router.get("/personal-profiles", response_model=PersonalProfileMapResponse)
async def get_personal_profiles_map(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_alert_tables()
    return await build_personal_profile_map(db)


@router.post("/scan", response_model=PersonnelAlertDashboardResponse)
async def manual_scan_personnel_alerts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_alert_tables()
    await scan_and_sync_alerts(db)
    return await build_alert_dashboard(db)


@router.patch("/batch-status", response_model=PersonnelAlertDashboardResponse)
async def batch_update_alert_status(
    body: BatchStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _ensure_alert_tables()
    valid_statuses = {
        AlertWorkflowStatus.WAITING,
        AlertWorkflowStatus.IN_PROGRESS,
        AlertWorkflowStatus.PENDING_DECISION,
        AlertWorkflowStatus.COMPLETED,
        AlertWorkflowStatus.ON_HOLD,
        AlertWorkflowStatus.REJECTED,
    }
    if body.workflow_status not in valid_statuses:
        raise BadRequestError(detail="Trạng thái xử lý không hợp lệ")

    uuids = []
    for raw_id in body.alert_ids:
        try:
            uuids.append(UUID(raw_id))
        except ValueError:
            continue

    if uuids:
        res = await db.execute(select(VcPersonnelAlert).where(VcPersonnelAlert.id.in_(uuids)))
        records = res.scalars().all()
        for rec in records:
            old_status = rec.workflow_status
            rec.workflow_status = body.workflow_status
            if body.process_notes is not None and body.process_notes.strip():
                rec.process_notes = body.process_notes.strip()
            append_action_history(
                rec,
                actor_name=current_user.full_name,
                action_type="STATUS_CHANGE",
                action_label=f"Chuyển bước xử lý sang '{body.workflow_status}'",
                from_status=old_status,
                to_status=body.workflow_status,
                reason=body.process_notes,
            )
        await db.commit()

    return await build_alert_dashboard(db)


@router.post("/upload-decision")
async def upload_decision_pdf(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "quyet_dinh.pdf")[1].lower()
    if ext not in [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]:
        raise BadRequestError(detail="Chỉ hỗ trợ tệp đính kèm PDF, Word hoặc hình ảnh scan Quyết định")

    decisions_dir = os.path.join(os.getcwd(), "uploads", "decision_files")
    os.makedirs(decisions_dir, exist_ok=True)
    safe_name = f"qd_{uuid.uuid4().hex[:10]}{ext}"
    filepath = os.path.join(decisions_dir, safe_name)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    return {
        "file_url": f"/api/v1/personnel-alerts/files/{safe_name}",
        "file_name": file.filename or safe_name,
    }


@router.get("/files/{filename}")
async def serve_decision_file(filename: str):
    safe_filename = os.path.basename(filename)
    filepath = os.path.join(os.getcwd(), "uploads", "decision_files", safe_filename)
    if not os.path.isfile(filepath):
        raise NotFoundError(detail="Không tìm thấy tệp Quyết định đính kèm")
    return FileResponse(filepath)


@router.post("/{alert_id}/extend", response_model=PersonnelAlertDashboardResponse)
async def extend_alert_processing_deadline(
    alert_id: str,
    body: ExtendAlertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kịch bản 2 (BA v2.0): Gia hạn thời gian xử lý hồ sơ hành chính.
    - Bảo toàn Ngày đến hạn hưởng chế độ gốc (`due_date`) của viên chức để tính truy lĩnh khi ban hành Quyết định.
    - Dời hạn chót nhắc việc hành chính sang `extended_deadline` và gỡ báo động đỏ Quá hạn trong thời gian gia hạn.
    """
    await _ensure_alert_tables()
    if not body.extension_reason or len(body.extension_reason.strip()) < 5:
        raise BadRequestError(detail="Vui lòng nhập rõ lý do gia hạn xử lý hồ sơ (tối thiểu 5 ký tự)")

    try:
        alert_uuid = UUID(alert_id)
    except ValueError:
        raise NotFoundError(detail="Mã cảnh báo không hợp lệ")

    res = await db.execute(select(VcPersonnelAlert).where(VcPersonnelAlert.id == alert_uuid))
    alert_obj = res.scalar_one_or_none()
    if not alert_obj:
        raise NotFoundError(detail="Không tìm thấy bản ghi cảnh báo")

    old_status = alert_obj.workflow_status
    new_status = body.target_status if body.target_status in (
        AlertWorkflowStatus.PENDING_DECISION,
        AlertWorkflowStatus.IN_PROGRESS,
        AlertWorkflowStatus.ON_HOLD,
        AlertWorkflowStatus.WAITING,
    ) else alert_obj.workflow_status

    alert_obj.extended_deadline = body.extended_deadline
    alert_obj.extension_count = (alert_obj.extension_count or 0) + 1
    alert_obj.extension_reason = body.extension_reason.strip()
    alert_obj.workflow_status = new_status
    alert_obj.is_manually_adjusted = 1
    alert_obj.process_notes = (
        f"[Gia hạn lần {alert_obj.extension_count} đến {body.extended_deadline.strftime('%d/%m/%Y')}]: "
        f"{body.extension_reason.strip()}"
    )

    append_action_history(
        alert_obj,
        actor_name=current_user.full_name,
        action_type="EXTEND_DEADLINE",
        action_label=f"Gia hạn xử lý hồ sơ đến ngày {body.extended_deadline.strftime('%d/%m/%Y')} (Lần {alert_obj.extension_count})",
        from_status=old_status,
        to_status=new_status,
        reason=body.extension_reason.strip(),
    )

    await db.commit()
    return await build_alert_dashboard(db)


@router.post("/{alert_id}/reject", response_model=PersonnelAlertDashboardResponse)
async def reject_alert_issuance(
    alert_id: str,
    body: RejectAlertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kịch bản 3 (BA v2.0): Từ chối ban hành Quyết định:
    - Phương án 1 (`DELAY_CYCLE`): Từ chối xét đợt này và lùi kỳ xét thêm +3/+6/+12 tháng (do không hoàn thành nhiệm vụ hoặc kỷ luật phát sinh), tự động cập nhật `due_date` mới.
    - Phương án 2 (`CLOSE_REJECTED`): Từ chối ban hành & đóng cảnh báo (ví dụ: không bổ nhiệm lại chức vụ quản lý).
    """
    await _ensure_alert_tables()
    if not body.rejection_reason or len(body.rejection_reason.strip()) < 5:
        raise BadRequestError(detail="Vui lòng nhập rõ lý do từ chối ban hành / căn cứ biên bản Hội đồng")

    try:
        alert_uuid = UUID(alert_id)
    except ValueError:
        raise NotFoundError(detail="Mã cảnh báo không hợp lệ")

    res = await db.execute(
        select(VcPersonnelAlert)
        .options(selectinload(VcPersonnelAlert.profile))
        .where(VcPersonnelAlert.id == alert_uuid)
    )
    alert_obj = res.scalar_one_or_none()
    if not alert_obj or not alert_obj.profile:
        raise NotFoundError(detail="Không tìm thấy bản ghi cảnh báo")

    prof: VcProfile = alert_obj.profile
    old_status = alert_obj.workflow_status
    reason_clean = body.rejection_reason.strip()

    if body.rejection_mode == "DELAY_CYCLE":
        delay_m = max(1, int(body.penalty_delay_months or 6))
        old_due_str = alert_obj.due_date.strftime("%d/%m/%Y")
        new_due = add_months(alert_obj.due_date, delay_m)
        alert_obj.penalty_delay_months = (alert_obj.penalty_delay_months or 0) + delay_m
        alert_obj.due_date = new_due
        alert_obj.extended_deadline = None
        alert_obj.rejection_reason = reason_clean
        alert_obj.workflow_status = AlertWorkflowStatus.WAITING
        alert_obj.is_manually_adjusted = 1
        alert_obj.process_notes = (
            f"[Từ chối đợt {old_due_str} — Lùi +{delay_m} tháng sang {new_due.strftime('%d/%m/%Y')}]: {reason_clean}"
        )
        prof.next_promotion_date = new_due

        append_action_history(
            alert_obj,
            actor_name=current_user.full_name,
            action_type="REJECT_DELAY_CYCLE",
            action_label=f"Từ chối xét đợt này & Lùi kỳ xét thêm +{delay_m} tháng (Hạn mới: {new_due.strftime('%d/%m/%Y')})",
            from_status=old_status,
            to_status=AlertWorkflowStatus.WAITING,
            reason=reason_clean,
        )
    else:
        alert_obj.rejection_reason = reason_clean
        alert_obj.workflow_status = AlertWorkflowStatus.REJECTED
        alert_obj.extended_deadline = None
        alert_obj.is_manually_adjusted = 1
        alert_obj.completed_at = datetime.utcnow()
        alert_obj.decision_number = body.decision_number
        alert_obj.decision_file_url = body.decision_file_url
        alert_obj.decision_file_name = body.decision_file_name
        alert_obj.process_notes = f"[Đã từ chối ban hành]: {reason_clean}"

        # Nếu là từ chối bổ nhiệm lại chức vụ quản lý -> Lưu lịch sử kết thúc nhiệm kỳ và ngừng tính phụ cấp lãnh đạo
        if alert_obj.alert_category in (AlertCategory.REAPPOINTMENT, AlertCategory.EXTEND_TO_RETIREMENT):
            old_pos = alert_obj.leadership_position or prof.leadership_position or "Cán bộ quản lý"
            db.add(
                VcWorkExperience(
                    profile_id=prof.id,
                    from_month_year=alert_obj.cycle_start_date.strftime("%m/%Y"),
                    to_month_year=datetime.now().strftime("%m/%Y"),
                    organization_name=prof.work_unit_name or "Đơn vị sự nghiệp",
                    department_name=prof.work_unit_name or "Phòng chuyên môn",
                    position_name=old_pos,
                    main_duties=f"Thôi giữ chức vụ quản lý / Không bổ nhiệm lại ({reason_clean})",
                )
            )
            prof.leadership_allowance = Decimal("0.00")

        append_action_history(
            alert_obj,
            actor_name=current_user.full_name,
            action_type="REJECT_CLOSE",
            action_label="Từ chối ban hành Quyết định & Đóng cảnh báo",
            from_status=old_status,
            to_status=AlertWorkflowStatus.REJECTED,
            reason=reason_clean,
        )

    await db.commit()
    return await build_alert_dashboard(db)


@router.post("/{alert_id}/rollback", response_model=PersonnelAlertDashboardResponse)
async def rollback_or_hold_alert(
    alert_id: str,
    body: RollbackAlertRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Luồng bổ sung FLOW-01 & FLOW-02:
    - Trả lại bước trước (Rollback từ Bước 3 về Bước 2 `IN_PROGRESS` hoặc Bước 1 `WAITING` để sửa/bổ sung hồ sơ).
    - Hoặc chuyển sang `ON_HOLD` (Tạm dừng cảnh báo do đang thanh tra, xem xét kỷ luật, nghỉ thai sản/đi học).
    """
    await _ensure_alert_tables()
    if not body.reason or len(body.reason.strip()) < 3:
        raise BadRequestError(detail="Vui lòng nhập lý do chuyển bước / trả lại hồ sơ")

    try:
        alert_uuid = UUID(alert_id)
    except ValueError:
        raise NotFoundError(detail="Mã cảnh báo không hợp lệ")

    res = await db.execute(select(VcPersonnelAlert).where(VcPersonnelAlert.id == alert_uuid))
    alert_obj = res.scalar_one_or_none()
    if not alert_obj:
        raise NotFoundError(detail="Không tìm thấy bản ghi cảnh báo")

    old_status = alert_obj.workflow_status
    alert_obj.workflow_status = body.target_status
    alert_obj.is_manually_adjusted = 1
    alert_obj.process_notes = body.reason.strip()
    if body.target_status == AlertWorkflowStatus.ON_HOLD:
        alert_obj.extension_reason = body.reason.strip()

    label_map = {
        AlertWorkflowStatus.IN_PROGRESS: "Trả lại Bước 2 (Đang lập hồ sơ) để rà soát / bổ sung",
        AlertWorkflowStatus.WAITING: "Đưa về Bước 1 (Chờ xử lý)",
        AlertWorkflowStatus.PENDING_DECISION: "Trình lên Bước 3 (Chờ ban hành Quyết định)",
        AlertWorkflowStatus.ON_HOLD: "Tạm hoãn xét duyệt hồ sơ (ON_HOLD)",
    }
    append_action_history(
        alert_obj,
        actor_name=current_user.full_name,
        action_type="ROLLBACK_OR_HOLD",
        action_label=label_map.get(body.target_status, f"Chuyển sang {body.target_status}"),
        from_status=old_status,
        to_status=body.target_status,
        reason=body.reason.strip(),
    )

    await db.commit()
    return await build_alert_dashboard(db)


@router.post("/{alert_id}/complete", response_model=PersonnelAlertDashboardResponse)
async def complete_alert_with_decision(
    alert_id: str,
    body: CompleteAlertDecisionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kịch bản 1 (BA v2.0): Duyệt & Ban hành Quyết định chính thức để chuyển sang Bước 4 (COMPLETED).
    - Nếu bản ghi đã ở Bước 4 (FLOW-04: Đính chính Quyết định), hệ thống cập nhật đính chính mà không tạo dòng lịch sử trùng lặp.
    """
    await _ensure_alert_tables()
    try:
        alert_uuid = UUID(alert_id)
    except ValueError:
        raise NotFoundError(detail="Mã cảnh báo không hợp lệ")

    res = await db.execute(
        select(VcPersonnelAlert)
        .options(selectinload(VcPersonnelAlert.profile))
        .where(VcPersonnelAlert.id == alert_uuid)
    )
    alert_obj = res.scalar_one_or_none()
    if not alert_obj or not alert_obj.profile:
        raise NotFoundError(detail="Không tìm thấy cảnh báo cần cập nhật")

    prof: VcProfile = alert_obj.profile
    was_already_completed = alert_obj.workflow_status == AlertWorkflowStatus.COMPLETED
    old_status = alert_obj.workflow_status
    old_decision_no = alert_obj.decision_number

    # 1. Cập nhật thông tin trên bản ghi Cảnh báo -> Chuyển sang Bước 4 (COMPLETED)
    alert_obj.decision_number = body.decision_number.strip()
    alert_obj.decision_date = body.decision_date
    alert_obj.effective_date = body.effective_date
    alert_obj.decision_file_url = body.decision_file_url
    alert_obj.decision_file_name = body.decision_file_name
    alert_obj.workflow_status = AlertWorkflowStatus.COMPLETED
    alert_obj.extended_deadline = None
    alert_obj.is_manually_adjusted = 1
    alert_obj.completed_at = datetime.utcnow()
    if body.process_notes:
        alert_obj.process_notes = body.process_notes.strip()

    is_appointment = alert_obj.alert_category in (
        AlertCategory.REAPPOINTMENT,
        AlertCategory.EXTEND_TO_RETIREMENT,
    )

    if not is_appointment:
        new_step = body.new_step if body.new_step is not None else (alert_obj.proposed_step or prof.salary_step)
        new_coeff = body.new_coefficient if body.new_coefficient is not None else (alert_obj.proposed_coefficient or prof.salary_coefficient)
        new_exceed = body.new_exceed_percent if body.new_exceed_percent is not None else (alert_obj.proposed_exceed_percent or prof.seniority_exceed_percent)

        prof.salary_step = new_step
        prof.salary_coefficient = new_coeff
        prof.seniority_exceed_percent = new_exceed
        prof.salary_effective_date = body.effective_date

        _, std_cycle, _ = detect_rank_tier_and_cycle(prof)
        next_cycle = 12 if (new_exceed and float(new_exceed) >= 5.0) else std_cycle
        prof.next_promotion_date = add_months(body.effective_date, next_cycle)

        reason_label = (
            f"Xét hưởng phụ cấp thâm niên vượt khung ({new_exceed}%)"
            if alert_obj.alert_category == AlertCategory.SALARY_EXCEED
            else (
                "Nâng bậc lương trước thời hạn"
                if alert_obj.alert_category == AlertCategory.SALARY_EARLY
                else "Nâng bậc lương thường xuyên"
            )
        )

        # FLOW-04: Nếu là đính chính Quyết định ở Bước 4, tìm bản ghi lương đã tạo để sửa thay vì tạo trùng
        existing_log = None
        if was_already_completed and old_decision_no:
            log_res = await db.execute(
                select(VcSalaryLog).where(
                    VcSalaryLog.profile_id == prof.id,
                    VcSalaryLog.decision_number == old_decision_no,
                )
            )
            existing_log = log_res.scalars().first()

        if existing_log:
            existing_log.decision_date = body.decision_date
            existing_log.decision_number = body.decision_number.strip()
            existing_log.salary_step = new_step
            existing_log.coefficient = new_coeff
            existing_log.effective_date = body.effective_date
            existing_log.reason = reason_label
        else:
            db.add(
                VcSalaryLog(
                    profile_id=prof.id,
                    decision_date=body.decision_date,
                    decision_number=body.decision_number.strip(),
                    rank_code=prof.professional_title_code or alert_obj.rank_tier,
                    salary_step=new_step,
                    coefficient=new_coeff,
                    effective_date=body.effective_date,
                    reason=reason_label,
                )
            )
    else:
        new_pos = (
            body.new_leadership_position.strip()
            if body.new_leadership_position and body.new_leadership_position.strip()
            else (alert_obj.leadership_position or prof.leadership_position or "Cán bộ quản lý")
        )
        prof.leadership_position = new_pos
        prof.reappointment_date = body.effective_date
        prof.appointment_term = (
            body.appointment_term
            or (
                "Kéo dài đến tuổi nghỉ hưu"
                if alert_obj.alert_category == AlertCategory.EXTEND_TO_RETIREMENT
                else "05 năm (60 tháng)"
            )
        )

        action_label = (
            "Kéo dài thời gian giữ chức vụ lãnh đạo đến tuổi nghỉ hưu"
            if alert_obj.alert_category == AlertCategory.EXTEND_TO_RETIREMENT
            else "Bổ nhiệm lại chức vụ lãnh đạo, quản lý (Nhiệm kỳ 05 năm)"
        )
        if not was_already_completed:
            db.add(
                VcWorkExperience(
                    profile_id=prof.id,
                    from_month_year=body.effective_date.strftime("%m/%Y"),
                    to_month_year="Nay",
                    organization_name=prof.work_unit_name or "Đơn vị sự nghiệp",
                    department_name=prof.work_unit_name or "Ban Lãnh đạo / Phòng chuyên môn",
                    position_name=new_pos,
                    main_duties=f"{action_label} theo Quyết định số {body.decision_number.strip()} ngày {body.decision_date.strftime('%d/%m/%Y')}",
                )
            )

    append_action_history(
        alert_obj,
        actor_name=current_user.full_name,
        action_type="APPROVE_COMPLETE",
        action_label=(
            f"Đính chính Quyết định số {body.decision_number.strip()}"
            if was_already_completed
            else f"Duyệt & Ban hành Quyết định số {body.decision_number.strip()} (Chuyển sang Bước 4: Hoàn thành)"
        ),
        from_status=old_status,
        to_status=AlertWorkflowStatus.COMPLETED,
        reason=f"Ngày ký: {body.decision_date.strftime('%d/%m/%Y')} — Ngày hưởng: {body.effective_date.strftime('%d/%m/%Y')}",
    )

    await db.commit()
    return await build_alert_dashboard(db)
