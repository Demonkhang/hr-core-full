import calendar
import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, Tuple, List, Dict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.employee import Employee
from app.models.department import Department
from app.models.user import User
from app.models.personnel_profile import (
    VcProfile,
    VcDiscipline,
    VcReward,
    VcAnnualEvaluation,
)
from app.models.personnel_alert import (
    VcPersonnelAlert,
    AlertCategory,
    AlertWorkflowStatus,
)
from app.schemas.personnel_alert import (
    AlertActionHistoryEntry,
    PersonnelAlertItemResponse,
    PersonnelAlertKpiSummary,
    PersonnelAlertDashboardResponse,
    PersonalProfileMapItem,
    PersonalProfileMapSummary,
    PersonalProfileMapResponse,
)

# Bảng thang bậc lương viên chức chuẩn theo Nghị định 204/2004/NĐ-CP
SALARY_SCALES: Dict[str, List[Decimal]] = {
    "Hạng I": [
        Decimal("6.20"), Decimal("6.56"), Decimal("6.92"),
        Decimal("7.28"), Decimal("7.64"), Decimal("8.00"),
    ],
    "Hạng II": [
        Decimal("4.40"), Decimal("4.74"), Decimal("5.08"), Decimal("5.42"),
        Decimal("5.76"), Decimal("6.10"), Decimal("6.44"), Decimal("6.78"),
    ],
    "Hạng III": [
        Decimal("2.34"), Decimal("2.67"), Decimal("3.00"), Decimal("3.33"),
        Decimal("3.66"), Decimal("3.99"), Decimal("4.32"), Decimal("4.65"), Decimal("4.98"),
    ],
    "Hạng IV": [
        Decimal("2.10"), Decimal("2.41"), Decimal("2.72"), Decimal("3.03"), Decimal("3.34"),
        Decimal("3.65"), Decimal("3.96"), Decimal("4.27"), Decimal("4.58"), Decimal("4.89"),
    ],
}

ALERT_CATEGORY_LABELS = {
    AlertCategory.SALARY_REGULAR: "Nâng bậc lương thường xuyên",
    AlertCategory.SALARY_EXCEED: "Phụ cấp thâm niên vượt khung",
    AlertCategory.SALARY_EARLY: "Nâng bậc lương trước thời hạn",
    AlertCategory.REAPPOINTMENT: "Bổ nhiệm lại chức vụ quản lý",
    AlertCategory.EXTEND_TO_RETIREMENT: "Kéo dài thời gian giữ chức vụ đến tuổi nghỉ hưu",
}


def add_months(source_date: date, months: int) -> date:
    """Cộng chính xác số tháng vào một ngày (xử lý ngày cuối tháng như 29/02, 31/03...)"""
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def parse_action_history(raw_json: Optional[str]) -> List[AlertActionHistoryEntry]:
    if not raw_json:
        return []
    try:
        arr = json.loads(raw_json)
        if isinstance(arr, list):
            return [AlertActionHistoryEntry(**item) for item in arr]
    except Exception:
        pass
    return []


def append_action_history(
    alert_obj: VcPersonnelAlert,
    actor_name: str,
    action_type: str,
    action_label: str,
    from_status: Optional[str],
    to_status: Optional[str],
    reason: Optional[str] = None,
) -> None:
    entries = []
    if alert_obj.action_history_json:
        try:
            entries = json.loads(alert_obj.action_history_json)
            if not isinstance(entries, list):
                entries = []
        except Exception:
            entries = []
    entries.insert(
        0,
        {
            "timestamp": datetime.now().strftime("%H:%M %d/%m/%Y"),
            "actor_name": actor_name or "Chuyên viên Nhân sự",
            "action_type": action_type,
            "action_label": action_label,
            "from_status": from_status,
            "to_status": to_status,
            "reason": reason,
        },
    )
    alert_obj.action_history_json = json.dumps(entries, ensure_ascii=False)


def detect_rank_tier_and_cycle(profile: VcProfile) -> Tuple[str, int, int]:
    """
    Xác định Hạng chức danh nghề nghiệp, Chu kỳ giữ bậc tiêu chuẩn (36 hoặc 24 tháng) và Bậc tối đa:
    - Đủ 36 tháng (3 năm): Hạng I (6 bậc), Hạng II (8 bậc), Hạng III (9 bậc - Đại học trở lên)
    - Đủ 24 tháng (2 năm): Hạng IV (10 bậc - Cao đẳng trở xuống)
    """
    title_text = f"{profile.professional_title_name or ''} {profile.professional_title_code or ''}".lower()
    degree_text = (profile.highest_professional_degree or "").lower()

    if "hạng iv" in title_text or "hang iv" in title_text or ("v.0" in title_text and ".04" in title_text) or "01.004" in title_text or "01.005" in title_text:
        return "Hạng IV", 24, 10
    if any(k in degree_text for k in ["cao đẳng", "trung cấp", "sơ cấp"]) and "hạng iii" not in title_text and "hạng ii" not in title_text and "hạng i" not in title_text:
        return "Hạng IV", 24, 10
    if "hạng i" in title_text and "hạng ii" not in title_text and "hạng iii" not in title_text and "hạng iv" not in title_text:
        return "Hạng I", 36, 6
    if "hạng ii" in title_text and "hạng iii" not in title_text:
        return "Hạng II", 36, 8
    return "Hạng III", 36, 9


def get_next_step_coefficient(rank_tier: str, next_step: int, current_coeff: Optional[Decimal]) -> Decimal:
    scale = SALARY_SCALES.get(rank_tier, SALARY_SCALES["Hạng III"])
    idx = next_step - 1
    if 0 <= idx < len(scale):
        return scale[idx]
    if current_coeff is not None:
        step_inc = Decimal("0.33") if rank_tier == "Hạng III" else (Decimal("0.34") if rank_tier == "Hạng II" else Decimal("0.31"))
        return current_coeff + step_inc
    return Decimal("2.67")


def calculate_discipline_delay(disciplines: List[VcDiscipline], cycle_start_date: date) -> Tuple[int, Optional[str]]:
    """
    Quy tắc tự động cộng dồn thời gian kéo dài (nếu có Kỷ luật trong chu kỳ giữ bậc):
    - Khiển trách: +03 tháng
    - Cảnh cáo: +06 tháng
    - Cách chức: +12 tháng
    """
    total_months = 0
    notes: List[str] = []
    for d in disciplines:
        if d.discipline_date and d.discipline_date < cycle_start_date:
            continue
        form_lower = (d.discipline_form or "").lower()
        added = 0
        if "cách chức" in form_lower or "cach chuc" in form_lower:
            added = 12
        elif "cảnh cáo" in form_lower or "canh cao" in form_lower:
            added = 6
        elif "khiển trách" in form_lower or "khien trach" in form_lower:
            added = 3
        if added > 0:
            total_months += added
            date_str = d.discipline_date.strftime("%d/%m/%Y") if d.discipline_date else "Trong chu kỳ"
            notes.append(f"{d.discipline_form} ({date_str}: +{added} tháng)")
    return total_months, "; ".join(notes) if notes else None


def calculate_early_salary_bonus(rewards: List[VcReward], cycle_start_date: date, has_discipline: bool) -> Tuple[int, Optional[str]]:
    if has_discipline or not rewards:
        return 0, None
    start_year = cycle_start_date.year
    matching: List[str] = []
    bonus_months = 0
    for r in rewards:
        if r.reward_year and r.reward_year >= start_year:
            form_lower = (r.reward_form or "").lower()
            if any(k in form_lower for k in ["huân chương", "chiến sĩ thi đua toàn quốc", "chiến sĩ thi đua cấp bộ", "chiến sĩ thi đua cấp tỉnh", "bằng khen của thủ tướng"]):
                bonus_months = max(bonus_months, 12)
                matching.append(f"{r.reward_form} ({r.reward_year})")
            elif any(k in form_lower for k in ["chiến sĩ thi đua cơ sở", "bằng khen"]):
                bonus_months = max(bonus_months, 6)
                matching.append(f"{r.reward_form} ({r.reward_year})")
    return bonus_months, "; ".join(matching) if matching else None


def calculate_retirement_date(dob: date, gender: Optional[str]) -> date:
    is_female = (gender or "").strip().lower() in ("nữ", "nu", "female", "f")
    if not is_female:
        retire_years = 62 if dob.year >= 1966 else 61
        retire_extra_months = 0 if dob.year >= 1966 else 6
    else:
        if dob.year <= 1969:
            retire_years = 57
            retire_extra_months = 0
        elif dob.year >= 1975:
            retire_years = 60
            retire_extra_months = 0
        else:
            total_m = 57 * 12 + (dob.year - 1969) * 4
            retire_years = total_m // 12
            retire_extra_months = total_m % 12

    base_retire = add_months(dob, retire_years * 12 + retire_extra_months)
    first_next_month = add_months(date(base_retire.year, base_retire.month, 1), 1)
    return first_next_month


def months_between(start_d: date, end_d: date) -> int:
    return (end_d.year - start_d.year) * 12 + (end_d.month - start_d.month) + (1 if end_d.day >= start_d.day else 0)


def summarize_evaluations(evaluations: List[VcAnnualEvaluation]) -> Optional[str]:
    if not evaluations:
        return "Hoàn thành tốt nhiệm vụ (Mặc định)"
    sorted_evals = sorted(evaluations, key=lambda x: x.evaluation_year or 0, reverse=True)[:3]
    return " | ".join(f"{e.evaluation_year}: {e.rating}" for e in sorted_evals)


def compute_milestone_and_guidance(
    alert_obj: VcPersonnelAlert,
    full_name: str,
    today: date,
) -> Tuple[int, str, str, str, str, Optional[str], bool]:
    """
    Trả về: (days_remaining, milestone_code, badge_color, badge_text, action_guidance, headline_message, is_extended_active)
    Bổ sung đầy đủ các luồng BA v2.0:
    - COMPLETED (Bước 4: Hoàn thành)
    - REJECTED (Đã từ chối ban hành / Không bổ nhiệm lại)
    - ON_HOLD (Đang tạm hoãn xét duyệt do thanh tra / xem xét kỷ luật / thai sản / đi học)
    - EXTENDED (Đang trong thời gian Gia hạn xử lý hành chính: bảo toàn ngày hưởng gốc due_date nhưng không báo đỏ quá hạn)
    """
    due_date = alert_obj.due_date
    days_remaining = (due_date - today).days
    due_str = due_date.strftime("%d/%m/%Y")
    workflow_status = alert_obj.workflow_status
    alert_category = alert_obj.alert_category

    if workflow_status == AlertWorkflowStatus.COMPLETED:
        return (
            days_remaining,
            "COMPLETED",
            "default",
            "Bước 4: Đã Duyệt & Ban hành Quyết định",
            "Hồ sơ đã được phê duyệt, cập nhật số Quyết định mới và đồng bộ vào lịch sử công tác/quá trình lương.",
            None,
            False,
        )

    if workflow_status == AlertWorkflowStatus.REJECTED:
        return (
            days_remaining,
            "REJECTED",
            "default",
            "Đã Từ chối ban hành / Đóng hồ sơ",
            f"Lý do từ chối: {alert_obj.rejection_reason or 'Theo kết luận của Hội đồng xét duyệt.'}",
            None,
            False,
        )

    if workflow_status == AlertWorkflowStatus.ON_HOLD:
        return (
            days_remaining,
            "ON_HOLD",
            "purple",
            "⏸️ Đang Tạm hoãn xét duyệt (Chờ kết luận / Đi học / Thai sản)",
            f"Hồ sơ đang tạm dừng xử lý ({alert_obj.extension_reason or alert_obj.process_notes or 'Chờ đủ điều kiện'}). Khi có kết luận sẽ mở lại và giữ nguyên ngày hưởng gốc {due_str}.",
            None,
            False,
        )

    # Kiểm tra xem hồ sơ có đang được Gia hạn xử lý hành chính hay không
    if alert_obj.extended_deadline:
        ext_days = (alert_obj.extended_deadline - today).days
        ext_str = alert_obj.extended_deadline.strftime("%d/%m/%Y")
        if ext_days >= 0:
            return (
                days_remaining,
                "EXTENDED",
                "purple",
                f"⏳ Đang Gia hạn xử lý đến {ext_str} (Còn {ext_days} ngày gia hạn)",
                f"Lý do gia hạn: {alert_obj.extension_reason or 'Bổ sung hồ sơ / Chờ họp Hội đồng'}. Lưu ý: Ngày hưởng chế độ gốc ({due_str}) vẫn được bảo lưu để tính truy lĩnh khi ban hành Quyết định.",
                f"Đồng chí {full_name} được gia hạn hoàn tất hồ sơ đến ngày {ext_str} (Ngày hưởng gốc: {due_str}).",
                True,
            )
        else:
            return (
                days_remaining,
                "T-0",
                "red",
                f"Huy hiệu đỏ: Quá hạn sau Gia hạn {abs(ext_days)} ngày (Hẹn gia hạn: {ext_str})",
                "Đã hết thời gian gia hạn xử lý hồ sơ! Đề nghị khẩn trương Duyệt ban hành Quyết định (sang Bước 4), Gia hạn tiếp hoặc Từ chối ban hành.",
                f"Hồ sơ đồng chí {full_name} đã quá hạn gia hạn ({ext_str}).",
                False,
            )

    is_appointment = alert_category in (AlertCategory.REAPPOINTMENT, AlertCategory.EXTEND_TO_RETIREMENT)

    if not is_appointment:
        if days_remaining <= 0:
            overdue_txt = f"Quá hạn {abs(days_remaining)} ngày" if days_remaining < 0 else "Đến hạn hôm nay (T-0)"
            return (
                days_remaining,
                "T-0",
                "red",
                f"Huy hiệu đỏ: Đến hạn ban hành Quyết định / Chờ cập nhật Quyết định mới ({overdue_txt})",
                "Sau khi có Quyết định nâng bậc lương được ký duyệt: Bấm 'Duyệt & Ban hành QĐ' để chuyển sang Bước 4 (Hoàn thành), hoặc bấm 'Gia hạn xử lý' / 'Từ chối' nếu chưa thể ban hành.",
                f"Đồng chí {full_name} đã đến hạn nâng bậc lương / phụ cấp vượt khung ngày {due_str}.",
                False,
            )
        elif days_remaining <= 30:
            return (
                days_remaining,
                "T-30",
                "gold",
                f"Huy hiệu vàng: Đến hạn lập hồ sơ Hội đồng lương (Còn {days_remaining} ngày)",
                'Bấm nút "Xuất danh sách" để tải biểu mẫu tổng hợp theo quy định, trình Lãnh đạo đơn vị thành lập Hội đồng xét nâng lương.',
                f"Đồng chí {full_name} đến hạn xét nâng lương vào ngày {due_str} (còn {days_remaining} ngày).",
                False,
            )
        elif days_remaining <= 90:
            return (
                days_remaining,
                "T-90",
                "green",
                f"Huy hiệu xanh lá: Sắp đến kỳ xét nâng lương Quý tới (Còn {days_remaining} ngày)",
                "Kiểm tra nhanh danh sách dự kiến, rà soát kết quả đánh giá phân loại viên chức của các năm trước và kiểm tra lại lịch sử kỷ luật/khen thưởng.",
                f"Đồng chí {full_name} dự kiến đến kỳ xét nâng lương ngày {due_str} (còn {days_remaining} ngày).",
                False,
            )
        else:
            return (
                days_remaining,
                "UPCOMING",
                "blue",
                f"Theo dõi dài hạn (Còn {days_remaining} ngày)",
                "Chưa đến mốc 90 ngày, hệ thống đang tự động theo dõi.",
                None,
                False,
            )
    else:
        headline = f"Đồng chí {full_name} hết nhiệm kỳ vào ngày {due_str} (còn {max(0, days_remaining)} ngày)"
        if days_remaining <= 0:
            overdue_txt = f"Quá hạn {abs(days_remaining)} ngày" if days_remaining < 0 else "Đến hạn hôm nay (T-0)"
            return (
                days_remaining,
                "T-0",
                "red",
                f"Huy hiệu đỏ: Đến hạn ban hành QĐ bổ nhiệm lại / Kéo dài chức vụ ({overdue_txt})",
                "Bấm 'Duyệt & Ban hành QĐ' để kết thúc quy trình (sang Bước 4) và kích hoạt bộ đếm 5 năm tiếp theo, hoặc bấm 'Gia hạn xử lý' / 'Từ chối bổ nhiệm lại'.",
                f"Đồng chí {full_name} đã hết nhiệm kỳ quản lý vào ngày {due_str} ({overdue_txt}).",
                False,
            )
        elif days_remaining <= 30:
            return (
                days_remaining,
                "T-30",
                "orange",
                f"Trước 30 ngày (T-30): Hoàn tất lấy phiếu tín nhiệm & trình hồ sơ (Còn {days_remaining} ngày)",
                "Cảnh báo nhắc nhở đơn vị hoàn tất việc lấy phiếu tín nhiệm và hoàn thiện hồ sơ trình cấp có thẩm quyền ra quyết định.",
                headline,
                False,
            )
        elif days_remaining <= 60:
            return (
                days_remaining,
                "T-60",
                "gold",
                f"Trước 60 ngày (T-60): Đôn đốc nộp Bản tự nhận xét nhiệm kỳ (Còn {days_remaining} ngày)",
                "Cảnh báo đôn đốc viên chức nộp Bản tự nhận xét, đánh giá kết quả thực hiện nhiệm vụ trong nhiệm kỳ.",
                headline,
                False,
            )
        elif days_remaining <= 90:
            return (
                days_remaining,
                "T-90",
                "gold",
                f"Trước 90 ngày (Mốc luật định): Ban hành Thông báo quy trình bổ nhiệm lại (Còn {days_remaining} ngày)",
                "Nhân sự tham mưu Lãnh đạo ban hành Thông báo thực hiện quy trình xem xét bổ nhiệm lại (hoặc kéo dài thời gian giữ chức vụ) gửi cho viên chức quản lý.",
                headline,
                False,
            )
        else:
            return (
                days_remaining,
                "UPCOMING",
                "blue",
                f"Theo dõi nhiệm kỳ (Còn {days_remaining} ngày)",
                "Chưa đến mốc 90 ngày trước khi hết nhiệm kỳ.",
                headline,
                False,
            )


async def ensure_demo_alert_scenarios(db: AsyncSession, today: date) -> None:
    existing_alerts = (await db.execute(select(VcPersonnelAlert))).scalars().all()
    if len(existing_alerts) >= 3:
        return

    emp_rows = (await db.execute(select(Employee).where(Employee.is_active == True).order_by(Employee.created_at.asc()))).scalars().all()
    if not emp_rows:
        return

    dept_rows = (await db.execute(select(Department))).scalars().all()
    dept_map = {str(d.id): d.name for d in dept_rows}

    profiles_res = await db.execute(
        select(VcProfile).options(
            selectinload(VcProfile.disciplines),
            selectinload(VcProfile.rewards),
            selectinload(VcProfile.annual_evaluations),
        )
    )
    prof_by_emp = {str(p.employee_id): p for p in profiles_res.scalars().all() if p.employee_id}

    scenarios = [
        {
            "title_name": "Chuyên viên (Hạng III)",
            "title_code": "01.003",
            "degree": "Thạc sĩ Quản lý công",
            "dob": date(1988, 5, 14),
            "gender": "Nam",
            "step": 4,
            "coeff": Decimal("3.33"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -36) + timedelta(days=22),
            "leadership": None,
            "appoint_date": None,
            "discipline": None,
            "reward": None,
            "eval_rating": "Hoàn thành xuất sắc nhiệm vụ",
        },
        {
            "title_name": "Chuyên viên chính / Chuyên viên (Hạng III)",
            "title_code": "01.003",
            "degree": "Đại học Kinh tế",
            "dob": date(1976, 8, 20),
            "gender": "Nữ",
            "step": 9,
            "coeff": Decimal("4.98"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -36) - timedelta(days=5),
            "leadership": None,
            "appoint_date": None,
            "discipline": None,
            "reward": None,
            "eval_rating": "Hoàn thành tốt nhiệm vụ",
        },
        {
            "title_name": "Chuyên viên (Hạng III)",
            "title_code": "01.003",
            "degree": "Đại học Luật",
            "dob": date(1990, 11, 2),
            "gender": "Nam",
            "step": 2,
            "coeff": Decimal("2.67"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -42) + timedelta(days=18),
            "leadership": None,
            "appoint_date": None,
            "discipline": ("Cảnh cáo", add_months(today, -20), "Vi phạm quy chế làm việc, kéo dài thời gian nâng bậc lương thêm 06 tháng"),
            "reward": None,
            "eval_rating": "Hoàn thành nhiệm vụ",
        },
        {
            "title_name": "Cán sự / Kỹ thuật viên (Hạng IV)",
            "title_code": "01.004",
            "degree": "Cao đẳng Hành chính",
            "dob": date(1995, 3, 10),
            "gender": "Nữ",
            "step": 3,
            "coeff": Decimal("2.72"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -24) + timedelta(days=68),
            "leadership": None,
            "appoint_date": None,
            "discipline": None,
            "reward": None,
            "eval_rating": "Hoàn thành tốt nhiệm vụ",
        },
        {
            "title_name": "Chuyên viên cao cấp (Hạng I)",
            "title_code": "01.001",
            "degree": "Tiến sĩ Quản lý nhà nước",
            "dob": date(1972, 4, 15),
            "gender": "Nam",
            "step": 6,
            "coeff": Decimal("8.00"),
            "exceed": Decimal("5.0"),
            "salary_eff": add_months(today, -12) + timedelta(days=14),
            "leadership": None,
            "appoint_date": None,
            "discipline": None,
            "reward": None,
            "eval_rating": "Hoàn thành xuất sắc nhiệm vụ",
        },
        {
            "title_name": "Chuyên viên chính (Hạng II)",
            "title_code": "01.002",
            "degree": "Thạc sĩ Quản trị nhân lực",
            "dob": date(1980, 9, 25),
            "gender": "Nam",
            "step": 4,
            "coeff": Decimal("5.42"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -18),
            "leadership": "Trưởng phòng Kế hoạch - Nghiệp vụ",
            "appoint_date": add_months(today, -60) + timedelta(days=78),
            "discipline": None,
            "reward": None,
            "eval_rating": "Hoàn thành xuất sắc nhiệm vụ",
        },
        {
            "title_name": "Chuyên viên chính (Hạng II)",
            "title_code": "01.002",
            "degree": "Thạc sĩ Tài chính",
            "dob": date(1982, 6, 12),
            "gender": "Nữ",
            "step": 3,
            "coeff": Decimal("5.08"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -15),
            "leadership": "Phó Trưởng phòng Kế hoạch - Tài chính",
            "appoint_date": add_months(today, -60) + timedelta(days=45),
            "discipline": None,
            "reward": None,
            "eval_rating": "Hoàn thành tốt nhiệm vụ",
        },
        {
            "title_name": "Chuyên viên chính (Hạng II)",
            "title_code": "01.002",
            "degree": "Đại học Tổng hợp",
            "dob": date(1966, 3, 10),
            "gender": "Nam",
            "step": 7,
            "coeff": Decimal("6.44"),
            "exceed": Decimal("0"),
            "salary_eff": add_months(today, -20),
            "leadership": "Trưởng ban Thanh tra - Pháp chế",
            "appoint_date": add_months(today, -60) + timedelta(days=25),
            "discipline": None,
            "reward": ("Chiến sĩ thi đua cấp Bộ", today.year - 1),
            "eval_rating": "Hoàn thành xuất sắc nhiệm vụ",
        },
    ]

    for idx, emp in enumerate(emp_rows[: len(scenarios)]):
        sc = scenarios[idx]
        prof = prof_by_emp.get(str(emp.id))
        if not prof:
            u_res = await db.execute(select(User).where(User.employee_id == emp.id))
            linked_user = u_res.scalars().first()
            prof = VcProfile(
                user_id=linked_user.id if linked_user else None,
                employee_id=emp.id,
                birth_full_name=emp.full_name.upper(),
                work_unit_name=dept_map.get(str(emp.department_id), "Đơn vị chuyên môn"),
            )
            db.add(prof)
            await db.flush()

        if not prof.salary_effective_date:
            prof.professional_title_name = sc["title_name"]
            prof.professional_title_code = sc["title_code"]
            prof.highest_professional_degree = sc["degree"]
            prof.date_of_birth = prof.date_of_birth or sc["dob"]
            prof.gender = prof.gender or sc["gender"]
            prof.salary_step = sc["step"]
            prof.salary_coefficient = sc["coeff"]
            prof.seniority_exceed_percent = sc["exceed"]
            prof.salary_effective_date = sc["salary_eff"]
            if sc["leadership"]:
                prof.leadership_position = sc["leadership"]
                prof.appointment_date = sc["appoint_date"]
                prof.leadership_allowance = Decimal("0.50")
            if sc["discipline"]:
                d_form, d_date, d_reason = sc["discipline"]
                db.add(
                    VcDiscipline(
                        profile_id=prof.id,
                        discipline_form=d_form,
                        discipline_date=d_date,
                        issuing_authority="Hội đồng Kỷ luật Đơn vị",
                        reason=d_reason,
                    )
                )
            if sc["reward"]:
                r_form, r_year = sc["reward"]
                db.add(
                    VcReward(
                        profile_id=prof.id,
                        reward_form=r_form,
                        reward_year=r_year,
                        decision_number=f"QĐ-{r_year}/KT",
                        issuing_authority="Cấp Bộ/Tỉnh",
                    )
                )
            db.add(
                VcAnnualEvaluation(
                    profile_id=prof.id,
                    evaluation_year=today.year - 1,
                    rating=sc["eval_rating"],
                    notes="Đánh giá phân loại viên chức định kỳ hằng năm",
                )
            )

    await db.commit()




async def scan_and_sync_alerts(db: AsyncSession, today: Optional[date] = None) -> None:
    if today is None:
        today = date.today()

    profiles_res = await db.execute(
        select(VcProfile).options(
            selectinload(VcProfile.disciplines),
            selectinload(VcProfile.rewards),
            selectinload(VcProfile.annual_evaluations),
        )
    )
    profiles = profiles_res.scalars().all()

    existing_res = await db.execute(select(VcPersonnelAlert))
    existing_alerts = existing_res.scalars().all()
    alert_map: Dict[Tuple[str, str, date], VcPersonnelAlert] = {
        (str(a.profile_id), a.alert_category, a.cycle_start_date): a
        for a in existing_alerts
    }

    for prof in profiles:
        eval_summary = summarize_evaluations(prof.annual_evaluations)

        # 1. RÀ SOÁT CẢNH BÁO NÂNG BẬC LƯƠNG & PHỤ CẤP THÂM NIÊN VƯỢT KHUNG
        if prof.salary_effective_date and prof.salary_step:
            rank_tier, std_cycle_months, max_step = detect_rank_tier_and_cycle(prof)
            delay_months, disc_details = calculate_discipline_delay(
                prof.disciplines, prof.salary_effective_date
            )
            early_bonus, reward_details = calculate_early_salary_bonus(
                prof.rewards, prof.salary_effective_date, delay_months > 0
            )

            curr_exceed = Decimal(str(prof.seniority_exceed_percent or 0))
            is_max_step = prof.salary_step >= max_step

            if not is_max_step:
                category = AlertCategory.SALARY_REGULAR
                cycle_m = std_cycle_months
                base_due = add_months(prof.salary_effective_date, cycle_m)
                prop_step = prof.salary_step + 1
                prop_coeff = get_next_step_coefficient(rank_tier, prop_step, prof.salary_coefficient)
                prop_exceed = Decimal("0")
            else:
                category = AlertCategory.SALARY_EXCEED
                if curr_exceed <= Decimal("0"):
                    cycle_m = 36
                    prop_exceed = Decimal("5.0")
                else:
                    cycle_m = 12
                    prop_exceed = curr_exceed + Decimal("1.0")

                base_due = add_months(prof.salary_effective_date, cycle_m)
                prop_step = prof.salary_step
                prop_coeff = prof.salary_coefficient

            key = (str(prof.id), category, prof.salary_effective_date)
            alert_obj = alert_map.get(key)

            # Cộng thêm số tháng bị Hội đồng lùi kỳ xét (nếu từng bị từ chối lùi kỳ)
            penalty_m = (alert_obj.penalty_delay_months or 0) if alert_obj else 0
            final_due = add_months(base_due, delay_months + penalty_m)
            days_left = (final_due - today).days

            if days_left <= 90 or alert_obj is not None:
                if alert_obj is None:
                    init_status = AlertWorkflowStatus.WAITING
                    if 0 < days_left <= 25 and delay_months == 0 and category == AlertCategory.SALARY_REGULAR:
                        init_status = AlertWorkflowStatus.IN_PROGRESS
                    elif days_left <= 0 and category == AlertCategory.SALARY_EXCEED:
                        init_status = AlertWorkflowStatus.PENDING_DECISION

                    alert_obj = VcPersonnelAlert(
                        profile_id=prof.id,
                        alert_category=category,
                        cycle_start_date=prof.salary_effective_date,
                        workflow_status=init_status,
                    )
                    append_action_history(
                        alert_obj,
                        actor_name="Hệ thống Tự động (00:01)",
                        action_type="AUTO_DETECT",
                        action_label="Hệ thống tự động phát hiện hồ sơ đến kỳ cảnh báo",
                        from_status=None,
                        to_status=init_status,
                        reason=f"Chu kỳ {cycle_m} tháng (Hưởng từ {prof.salary_effective_date.strftime('%d/%m/%Y')})",
                    )
                    db.add(alert_obj)
                    alert_map[key] = alert_obj

                # Lưu ý BA số 1 (Scanner Idempotency): Không ghi đè nếu hồ sơ đã đóng (COMPLETED / REJECTED)
                if alert_obj.workflow_status not in (
                    AlertWorkflowStatus.COMPLETED,
                    AlertWorkflowStatus.REJECTED,
                ):
                    alert_obj.standard_cycle_months = cycle_m
                    alert_obj.base_due_date = base_due
                    alert_obj.discipline_delay_months = delay_months
                    alert_obj.discipline_details = disc_details
                    alert_obj.early_bonus_months = early_bonus
                    alert_obj.reward_details = reward_details
                    if not alert_obj.is_manually_adjusted:
                        alert_obj.due_date = final_due
                    alert_obj.rank_tier = rank_tier
                    alert_obj.current_step = prof.salary_step
                    alert_obj.max_step = max_step
                    alert_obj.current_coefficient = prof.salary_coefficient
                    alert_obj.current_exceed_percent = curr_exceed
                    alert_obj.proposed_step = prop_step
                    alert_obj.proposed_coefficient = prop_coeff
                    alert_obj.proposed_exceed_percent = prop_exceed
                    alert_obj.evaluation_summary = eval_summary
                    prof.next_promotion_date = alert_obj.due_date

            # Xét Nâng lương trước thời hạn
            if not is_max_step and early_bonus > 0:
                early_due = add_months(base_due, -early_bonus)
                if (early_due - today).days < -30:
                    # Nếu hồ sơ đã bước vào quý xét nâng lương hiện tại, mốc xét trước hạn tính trong đợt họp Hội đồng quý này
                    early_due = today + timedelta(days=15)
                early_days_left = (early_due - today).days

                early_key = (str(prof.id), AlertCategory.SALARY_EARLY, prof.salary_effective_date)
                early_obj = alert_map.get(early_key)
                if early_days_left <= 90 or early_obj is not None:
                    if early_obj is None:
                        early_obj = VcPersonnelAlert(
                            profile_id=prof.id,
                            alert_category=AlertCategory.SALARY_EARLY,
                            cycle_start_date=prof.salary_effective_date,
                            workflow_status=AlertWorkflowStatus.WAITING,
                            process_notes=f"Đủ điều kiện xét nâng lương trước thời hạn {early_bonus} tháng do đạt thành tích: {reward_details}",
                        )
                        append_action_history(
                            early_obj,
                            actor_name="Hệ thống Tự động (00:01)",
                            action_type="AUTO_DETECT",
                            action_label=f"Đề xuất xét nâng lương trước thời hạn ({early_bonus} tháng)",
                            from_status=None,
                            to_status=AlertWorkflowStatus.WAITING,
                            reason=reward_details,
                        )
                        db.add(early_obj)
                        alert_map[early_key] = early_obj

                    if early_obj.workflow_status not in (
                        AlertWorkflowStatus.COMPLETED,
                        AlertWorkflowStatus.REJECTED,
                    ):
                        early_obj.standard_cycle_months = std_cycle_months
                        early_obj.base_due_date = base_due
                        early_obj.discipline_delay_months = 0
                        early_obj.early_bonus_months = early_bonus
                        early_obj.reward_details = reward_details
                        if not early_obj.is_manually_adjusted:
                            early_obj.due_date = early_due
                        early_obj.rank_tier = rank_tier
                        early_obj.current_step = prof.salary_step
                        early_obj.max_step = max_step
                        early_obj.current_coefficient = prof.salary_coefficient
                        early_obj.current_exceed_percent = curr_exceed
                        early_obj.proposed_step = prof.salary_step + 1
                        early_obj.proposed_coefficient = get_next_step_coefficient(
                            rank_tier, prof.salary_step + 1, prof.salary_coefficient
                        )
                        early_obj.proposed_exceed_percent = Decimal("0")
                        early_obj.evaluation_summary = eval_summary

        # 2. RÀ SOÁT CẢNH BÁO BỔ NHIỆM LẠI / KÉO DÀI GIỮ CHỨC VỤ ĐẾN TUỔI HƯU
        effective_appoint_date = prof.reappointment_date or prof.appointment_date
        if prof.leadership_position and effective_appoint_date:
            term_months = 60
            term_due_date = add_months(effective_appoint_date, term_months)

            retire_date: Optional[date] = None
            rem_months: int = 60
            if prof.date_of_birth:
                retire_date = calculate_retirement_date(prof.date_of_birth, prof.gender)
                rem_months = max(0, months_between(term_due_date, retire_date))

            app_category = (
                AlertCategory.REAPPOINTMENT
                if rem_months >= 18
                else AlertCategory.EXTEND_TO_RETIREMENT
            )

            app_days_left = (term_due_date - today).days
            app_key = (str(prof.id), app_category, effective_appoint_date)
            app_obj = alert_map.get(app_key)

            if app_days_left <= 90 or app_obj is not None:
                if app_obj is None:
                    init_app_status = (
                        AlertWorkflowStatus.IN_PROGRESS
                        if 0 < app_days_left <= 60
                        else AlertWorkflowStatus.WAITING
                    )
                    app_obj = VcPersonnelAlert(
                        profile_id=prof.id,
                        alert_category=app_category,
                        cycle_start_date=effective_appoint_date,
                        workflow_status=init_app_status,
                    )
                    append_action_history(
                        app_obj,
                        actor_name="Hệ thống Tự động (00:01)",
                        action_type="AUTO_DETECT",
                        action_label="Phát hiện cảnh báo hết nhiệm kỳ quản lý 05 năm (60 tháng)",
                        from_status=None,
                        to_status=init_app_status,
                        reason=f"Chức vụ: {prof.leadership_position} (Còn {rem_months} tháng công tác trước tuổi nghỉ hưu)",
                    )
                    db.add(app_obj)
                    alert_map[app_key] = app_obj

                if app_obj.workflow_status not in (
                    AlertWorkflowStatus.COMPLETED,
                    AlertWorkflowStatus.REJECTED,
                ):
                    app_obj.standard_cycle_months = term_months
                    app_obj.base_due_date = term_due_date
                    if not app_obj.is_manually_adjusted:
                        app_obj.due_date = term_due_date
                    app_obj.leadership_position = prof.leadership_position
                    app_obj.retirement_date = retire_date
                    app_obj.remaining_work_months = rem_months
                    app_obj.evaluation_summary = eval_summary

    await db.commit()


async def build_alert_dashboard(db: AsyncSession, today: Optional[date] = None) -> PersonnelAlertDashboardResponse:
    if today is None:
        today = date.today()

    await scan_and_sync_alerts(db, today)

    alerts_res = await db.execute(
        select(VcPersonnelAlert)
        .options(selectinload(VcPersonnelAlert.profile))
        .order_by(VcPersonnelAlert.due_date.asc())
    )
    alerts = alerts_res.scalars().all()

    emp_res = await db.execute(select(Employee))
    emp_map = {str(e.id): e for e in emp_res.scalars().all()}

    user_res = await db.execute(select(User))
    user_by_id = {str(u.id): u for u in user_res.scalars().all()}
    user_by_emp = {str(u.employee_id): u for u in user_res.scalars().all() if u.employee_id}

    dept_res = await db.execute(select(Department))
    dept_map = {str(d.id): d.name for d in dept_res.scalars().all()}

    items: List[PersonnelAlertItemResponse] = []
    summary = PersonnelAlertKpiSummary(
        last_scanned_at=datetime.now().strftime("%H:%M:%S %d/%m/%Y")
    )

    for a in alerts:
        prof = a.profile
        if not prof:
            continue

        emp = emp_map.get(str(prof.employee_id)) if prof.employee_id else None
        usr = (
            user_by_id.get(str(prof.user_id))
            if prof.user_id
            else (user_by_emp.get(str(prof.employee_id)) if prof.employee_id else None)
        )

        full_name = (
            emp.full_name
            if emp
            else (usr.full_name if usr else (prof.birth_full_name or "Viên chức"))
        )
        emp_code = (
            emp.employee_code
            if emp and emp.employee_code
            else (prof.official_file_code or None)
        )
        dept_name = (
            dept_map.get(str(emp.department_id))
            if emp and emp.department_id
            else (prof.work_unit_name or "Đơn vị sự nghiệp")
        )

        days_rem, milestone_code, badge_color, badge_text, guidance, headline, is_ext_active = compute_milestone_and_guidance(
            a,
            full_name,
            today,
        )

        # Nếu đã bị lùi kỳ xét xa hơn 90 ngày nhưng có lịch sử từ chối/gia hạn thủ công, vẫn cho phép hiển thị để nhân sự theo dõi
        if (
            milestone_code == "UPCOMING"
            and a.workflow_status not in (AlertWorkflowStatus.COMPLETED, AlertWorkflowStatus.REJECTED, AlertWorkflowStatus.ON_HOLD)
            and not a.is_manually_adjusted
        ):
            continue

        # Cập nhật bộ đếm KPI
        if a.workflow_status == AlertWorkflowStatus.COMPLETED:
            summary.completed_count += 1
        elif a.workflow_status in (AlertWorkflowStatus.REJECTED, AlertWorkflowStatus.ON_HOLD):
            summary.on_hold_or_rejected_count += 1
        else:
            summary.total_active_alerts += 1
            if is_ext_active:
                summary.extended_count += 1

            # Nếu đang được gia hạn hợp lệ (is_ext_active == True), không tính vào báo động đỏ Quá hạn
            if (days_rem <= 0 and not is_ext_active) or a.workflow_status == AlertWorkflowStatus.PENDING_DECISION:
                summary.overdue_or_pending_decision_count += 1
            elif a.workflow_status == AlertWorkflowStatus.IN_PROGRESS:
                summary.in_progress_count += 1
            else:
                summary.waiting_count += 1

            if a.alert_category == AlertCategory.SALARY_REGULAR:
                summary.salary_regular_count += 1
            elif a.alert_category == AlertCategory.SALARY_EXCEED:
                summary.salary_exceed_count += 1
            elif a.alert_category == AlertCategory.SALARY_EARLY:
                summary.salary_early_count += 1
            elif a.alert_category == AlertCategory.REAPPOINTMENT:
                summary.reappointment_count += 1
            elif a.alert_category == AlertCategory.EXTEND_TO_RETIREMENT:
                summary.extend_retirement_count += 1

        target_uid = str(usr.id) if usr else (str(emp.id) if emp else str(prof.id))

        items.append(
            PersonnelAlertItemResponse(
                id=str(a.id),
                profile_id=str(prof.id),
                user_id=target_uid,
                employee_id=str(emp.id) if emp else None,
                full_name=full_name,
                employee_code=emp_code,
                department_name=dept_name,
                date_of_birth=prof.date_of_birth,
                gender=prof.gender,
                highest_professional_degree=prof.highest_professional_degree,
                professional_title_name=prof.professional_title_name,
                professional_title_code=prof.professional_title_code,
                portrait_url=prof.portrait_url,
                alert_category=a.alert_category,
                alert_category_label=ALERT_CATEGORY_LABELS.get(a.alert_category, a.alert_category),
                cycle_start_date=a.cycle_start_date,
                standard_cycle_months=a.standard_cycle_months,
                base_due_date=a.base_due_date,
                discipline_delay_months=a.discipline_delay_months,
                discipline_details=a.discipline_details,
                early_bonus_months=a.early_bonus_months,
                reward_details=a.reward_details,
                due_date=a.due_date,
                days_remaining=days_rem,
                extended_deadline=a.extended_deadline,
                extension_count=a.extension_count or 0,
                extension_reason=a.extension_reason,
                is_extended_active=is_ext_active,
                rejection_reason=a.rejection_reason,
                penalty_delay_months=a.penalty_delay_months or 0,
                action_history=parse_action_history(a.action_history_json),
                milestone_code=milestone_code,
                badge_color=badge_color,
                badge_text=badge_text,
                action_guidance=guidance,
                headline_message=headline,
                rank_tier=a.rank_tier,
                current_step=a.current_step,
                max_step=a.max_step,
                current_coefficient=a.current_coefficient,
                current_exceed_percent=a.current_exceed_percent,
                leadership_allowance=prof.leadership_allowance,
                proposed_step=a.proposed_step,
                proposed_coefficient=a.proposed_coefficient,
                proposed_exceed_percent=a.proposed_exceed_percent,
                leadership_position=a.leadership_position or prof.leadership_position,
                retirement_date=a.retirement_date,
                remaining_work_months=a.remaining_work_months,
                evaluation_summary=a.evaluation_summary,
                workflow_status=a.workflow_status,
                process_notes=a.process_notes,
                decision_number=a.decision_number,
                decision_date=a.decision_date,
                effective_date=a.effective_date,
                decision_file_url=a.decision_file_url,
                decision_file_name=a.decision_file_name,
                completed_at=a.completed_at,
            )
        )

    return PersonnelAlertDashboardResponse(summary=summary, items=items)


async def build_personal_profile_map(
    db: AsyncSession, today: Optional[date] = None
) -> PersonalProfileMapResponse:
    """
    Xây dựng Sơ đồ Hồ sơ Cá nhân 360° (BA v4.0) dựa 100% trên dữ liệu thực tế hiện có
    trong cơ sở dữ liệu (`Employee`, `User`, `VcProfile`, `VcPersonnelAlert`),
    không tự động sinh hay ghi đè dữ liệu mẫu.
    """
    if today is None:
        today = date.today()

    dashboard = await build_alert_dashboard(db, today)
    alerts_by_profile: Dict[str, List[PersonnelAlertItemResponse]] = {}
    for alert_item in dashboard.items:
        if alert_item.workflow_status not in (
            AlertWorkflowStatus.COMPLETED,
            AlertWorkflowStatus.REJECTED,
        ):
            alerts_by_profile.setdefault(alert_item.profile_id, []).append(alert_item)

    profiles_res = await db.execute(
        select(VcProfile).options(
            selectinload(VcProfile.disciplines),
            selectinload(VcProfile.rewards),
            selectinload(VcProfile.annual_evaluations),
        )
    )
    profiles = profiles_res.scalars().all()

    emp_res = await db.execute(select(Employee).where(Employee.is_active == True))
    employees = emp_res.scalars().all()
    emp_map = {str(e.id): e for e in employees}

    user_res = await db.execute(select(User))
    all_users = user_res.scalars().all()
    user_by_id = {str(u.id): u for u in all_users}
    user_by_emp = {str(u.employee_id): u for u in all_users if u.employee_id}

    dept_res = await db.execute(select(Department))
    dept_map = {str(d.id): d.name for d in dept_res.scalars().all()}

    summary = PersonalProfileMapSummary()
    map_items: List[PersonalProfileMapItem] = []
    processed_emp_ids = set()

    for prof in profiles:
        emp = emp_map.get(str(prof.employee_id)) if prof.employee_id else None
        if emp:
            processed_emp_ids.add(str(emp.id))
        usr = user_by_id.get(str(prof.user_id)) if prof.user_id else None
        if not usr and emp:
            usr = user_by_emp.get(str(emp.id))

        full_name = (
            (emp.full_name if emp else None)
            or (usr.full_name if usr else None)
            or prof.birth_full_name
            or "Viên chức"
        )
        emp_code = (emp.employee_code if emp else None) or prof.official_file_code
        dept_name = (
            dept_map.get(str(emp.department_id))
            if emp and emp.department_id
            else prof.work_unit_name or "Chưa phân phòng"
        )
        target_uid = str(usr.id) if usr else (str(emp.id) if emp else str(prof.id))

        # 1. Phân loại Tư cách Viên chức dựa trên dữ liệu thực tế trong VcProfile
        prob_days_rem: Optional[int] = None
        if prof.probation_end_date and prof.probation_end_date > today:
            official_status = "PROBATION_VC"
            official_status_label = "Viên chức Đang tập sự"
            prob_days_rem = (prof.probation_end_date - today).days
            summary.probation_vc_count += 1
        elif (
            prof.professional_title_code
            or prof.professional_title_name
            or prof.first_recruitment_date
            or prof.salary_step
        ):
            official_status = "OFFICIAL_VC"
            official_status_label = "Đã là Viên chức Chính thức"
            summary.official_vc_count += 1
        else:
            official_status = "CONTRACT_STAFF"
            official_status_label = "Chưa cập nhật ngạch Viên chức"
            summary.non_vc_or_no_profile_count += 1

        # 2. Phân loại Tư cách Đảng viên CSVN dựa trên dữ liệu thực tế trong VcProfile
        party_seniority: Optional[int] = None
        party_due: Optional[date] = None
        party_days_rem: Optional[int] = None

        if (prof.cpv_official_date and prof.cpv_official_date <= today) or prof.cpv_card_number:
            party_status = "PARTY_OFFICIAL"
            party_status_label = "Đảng viên Chính thức"
            base_party_date = prof.cpv_probationary_date or prof.cpv_official_date
            if base_party_date:
                party_seniority = max(1, today.year - base_party_date.year)
            summary.party_official_count += 1
        elif prof.cpv_probationary_date:
            party_status = "PARTY_PROBATION"
            party_status_label = "Đảng viên Dự bị"
            party_due = add_months(prof.cpv_probationary_date, 12)
            party_days_rem = (party_due - today).days
            summary.party_probation_count += 1
        else:
            party_status = "NON_PARTY"
            party_status_label = "Chưa vào Đảng (Quần chúng)"
            summary.non_party_count += 1

        # 3. Chu kỳ Nâng bậc lương & Nhiệm kỳ Bổ nhiệm thực tế
        rank_tier, std_cycle_months, max_step = detect_rank_tier_and_cycle(prof)
        disc_delay, _ = calculate_discipline_delay(
            prof.disciplines, prof.salary_effective_date or today
        )
        total_salary_cycle_m = std_cycle_months + disc_delay
        salary_next_due: Optional[date] = None
        salary_days_rem: Optional[int] = None
        salary_prog_pct = 0

        if prof.salary_effective_date:
            if (
                prof.salary_step
                and prof.salary_step >= max_step
                and (prof.seniority_exceed_percent or Decimal("0")) > Decimal("0")
            ):
                total_salary_cycle_m = 12 + disc_delay
            salary_next_due = add_months(prof.salary_effective_date, total_salary_cycle_m)
            salary_days_rem = (salary_next_due - today).days
            total_days = max(1, (salary_next_due - prof.salary_effective_date).days)
            elapsed_days = max(0, (today - prof.salary_effective_date).days)
            salary_prog_pct = min(100, int(round((elapsed_days / total_days) * 100)))

        eff_appoint = prof.reappointment_date or prof.appointment_date
        reappoint_due: Optional[date] = None
        reappoint_days_rem: Optional[int] = None
        reappoint_prog_pct = 0
        if prof.leadership_position and eff_appoint:
            reappoint_due = add_months(eff_appoint, 60)
            reappoint_days_rem = (reappoint_due - today).days
            total_app_days = max(1, (reappoint_due - eff_appoint).days)
            elapsed_app_days = max(0, (today - eff_appoint).days)
            reappoint_prog_pct = min(100, int(round((elapsed_app_days / total_app_days) * 100)))

        retire_date: Optional[date] = None
        rem_work_months: Optional[int] = None
        if prof.date_of_birth:
            retire_date = calculate_retirement_date(prof.date_of_birth, prof.gender)
            rem_work_months = max(0, months_between(today, retire_date))

        person_alerts = alerts_by_profile.get(str(prof.id), [])
        has_overdue = any(
            a.days_remaining <= 0 and not a.is_extended_active for a in person_alerts
        )
        has_upcoming = len(person_alerts) > 0 and not has_overdue

        summary.total_personnel += 1
        if has_overdue:
            summary.with_overdue_alert_count += 1
        elif has_upcoming:
            summary.with_upcoming_alert_count += 1
        else:
            summary.safe_cycle_count += 1

        eval_summary = (
            summarize_evaluations(prof.annual_evaluations)
            if prof.annual_evaluations
            else None
        )

        map_items.append(
            PersonalProfileMapItem(
                id=str(prof.id),
                profile_id=str(prof.id),
                user_id=target_uid,
                employee_id=str(emp.id) if emp else None,
                full_name=full_name,
                employee_code=emp_code,
                department_name=dept_name,
                date_of_birth=prof.date_of_birth,
                gender=prof.gender,
                portrait_url=prof.portrait_url,
                highest_professional_degree=prof.highest_professional_degree,
                political_theory_level=prof.political_theory_level,
                official_status=official_status,
                official_status_label=official_status_label,
                first_recruitment_date=prof.first_recruitment_date,
                current_agency_join_date=prof.current_agency_join_date,
                probation_end_date=prof.probation_end_date,
                probation_days_remaining=prob_days_rem,
                professional_title_name=prof.professional_title_name,
                professional_title_code=prof.professional_title_code,
                rank_tier=rank_tier if (prof.professional_title_name or prof.professional_title_code) else None,
                party_status=party_status,
                party_status_label=party_status_label,
                cpv_probationary_date=prof.cpv_probationary_date,
                cpv_official_date=prof.cpv_official_date,
                cpv_card_number=prof.cpv_card_number,
                cpv_current_position=prof.cpv_current_position,
                cpv_admission_place=prof.cpv_admission_place,
                party_seniority_years=party_seniority,
                party_official_due_date=party_due,
                party_official_days_remaining=party_days_rem,
                youth_union_date=prof.youth_union_date,
                trade_union_date=prof.trade_union_date,
                salary_step=prof.salary_step,
                max_step=max_step if prof.salary_step else None,
                salary_coefficient=prof.salary_coefficient,
                seniority_exceed_percent=prof.seniority_exceed_percent,
                salary_effective_date=prof.salary_effective_date,
                salary_cycle_months=total_salary_cycle_m,
                discipline_delay_months=disc_delay,
                salary_next_due_date=salary_next_due,
                salary_days_remaining=salary_days_rem,
                salary_progress_percent=salary_prog_pct,
                leadership_position=prof.leadership_position,
                appointment_date=eff_appoint,
                reappointment_due_date=reappoint_due,
                reappointment_days_remaining=reappoint_days_rem,
                reappointment_progress_percent=reappoint_prog_pct,
                retirement_date=retire_date,
                remaining_work_months=rem_work_months,
                evaluation_summary=eval_summary,
                has_overdue_alert=has_overdue,
                has_upcoming_alert=has_upcoming,
                active_alerts_count=len(person_alerts),
                active_alerts=person_alerts,
            )
        )

    # Bổ sung những nhân viên thực tế trong bảng Employee chưa có bản ghi VcProfile (NO_VC_PROFILE)
    for emp in employees:
        if str(emp.id) in processed_emp_ids:
            continue
        usr = user_by_emp.get(str(emp.id))
        dept_name = dept_map.get(str(emp.department_id), "Chưa phân phòng")
        summary.total_personnel += 1
        summary.non_vc_or_no_profile_count += 1
        summary.non_party_count += 1
        summary.safe_cycle_count += 1

        map_items.append(
            PersonalProfileMapItem(
                id=f"emp-{emp.id}",
                profile_id=None,
                user_id=str(usr.id) if usr else str(emp.id),
                employee_id=str(emp.id),
                full_name=emp.full_name,
                employee_code=emp.employee_code,
                department_name=dept_name,
                official_status="NO_VC_PROFILE",
                official_status_label="Chưa lập Hồ sơ Viên chức (HS02-BNV)",
                first_recruitment_date=emp.hire_date,
                party_status="NON_PARTY",
                party_status_label="Chưa vào Đảng (Quần chúng)",
                leadership_position=emp.position,
                has_overdue_alert=False,
                has_upcoming_alert=False,
                active_alerts_count=0,
                active_alerts=[],
            )
        )

    map_items.sort(
        key=lambda x: (
            0 if x.has_overdue_alert else (1 if x.has_upcoming_alert else 2),
            x.salary_days_remaining if x.salary_days_remaining is not None else 9999,
        )
    )

    return PersonalProfileMapResponse(summary=summary, items=map_items)
