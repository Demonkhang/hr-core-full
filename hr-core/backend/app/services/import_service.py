from io import BytesIO
from typing import List, Dict, Any
from uuid import UUID
from datetime import datetime
from openpyxl import load_workbook
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.employee import Employee
from app.models.department import Department
from app.models.position import Position
from app.models.workplace import Workplace
from app.models.personnel_profile import VcProfile


REQUIRED_COLUMNS = [
    "full_name", "department_code",
]

OPTIONAL_COLUMNS = [
    "employee_code", "position", "phone", "email",
    "workplace_code", "hire_date", "cccd_number",
]

ALL_COLUMNS = REQUIRED_COLUMNS + [c for c in OPTIONAL_COLUMNS if c not in REQUIRED_COLUMNS]

COLUMN_MAP = {
    "Mã NV": "employee_code",
    "Mã nhân viên": "employee_code",
    "Họ tên": "full_name",
    "Họ và tên": "full_name",
    "Họ Và Tên": "full_name",
    "Họ Và Tên (*)": "full_name",
    "Phòng ban": "department_code",
    "Phòng ban (*)": "department_code",
    "Chức vụ": "position",
    "Chức vụ (*)": "position",
    "Nơi làm việc": "workplace_code",
    "Ngày vào làm": "hire_date",
    "SĐT": "phone",
    "Số điện thoại": "phone",
    "Điện thoại": "phone",
    "Điện thoại (*)": "phone",
    "Email": "email",
    "Hộp thư công vụ": "email",
    "Hộp thư công vụ(*)": "email",
    "Hộp thư công vụ (*)": "email",
    "CCCD": "cccd_number",
    "Số CCCD": "cccd_number",
    "Số Định Danh (CCCD)": "cccd_number",
    "Số Định Danh (CCCD) (*)": "cccd_number",
}


def _map_columns(headers: List[str]) -> Dict[int, str]:
    mapping = {}
    for i, h in enumerate(headers):
        h_stripped = h.strip()
        if h_stripped in COLUMN_MAP:
            mapping[i] = COLUMN_MAP[h_stripped]
        else:
            mapping[i] = h_stripped
    return mapping


def parse_excel(file_content: bytes) -> List[Dict[str, Any]]:
    wb = load_workbook(filename=BytesIO(file_content))
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("File Excel rỗng")

    headers = [str(c) if c is not None else "" for c in rows[0]]
    col_map = _map_columns(headers)

    missing = [c for c in REQUIRED_COLUMNS if c not in col_map.values()]
    if missing:
        raise ValueError(f"Thiếu cột bắt buộc: {', '.join(missing)}. "
                         f"Các cột hỗ trợ: {', '.join(COLUMN_MAP.keys())}")

    records = []
    errors = []
    for row_idx, row in enumerate(rows[1:], start=2):
        if all(c is None or str(c).strip() == "" for c in row):
            continue
        record = {}
        row_errors = []
        for col_idx, col_name in col_map.items():
            val = row[col_idx] if col_idx < len(row) else None
            if val is not None and isinstance(val, str):
                val = val.strip()
            if col_name == "full_name" and (val is None or str(val).strip() == ""):
                row_errors.append(f"Dòng {row_idx}: Họ tên không được để trống")
            if col_name == "department_code" and (val is None or str(val).strip() == ""):
                row_errors.append(f"Dòng {row_idx}: Mã bộ phận không được để trống")
            record[col_name] = val
        record["_row"] = row_idx
        if row_errors:
            errors.extend(row_errors)
        else:
            records.append(record)

    return records, errors


async def import_employees(
    db: AsyncSession,
    records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    imported = []
    errors = []

    dept_cache: Dict[str, UUID] = {}
    dept_name_map: Dict[UUID, str] = {}
    wp_cache: Dict[str, UUID] = {}
    pos_cache: Dict[str, UUID] = {}

    depts_result = await db.execute(select(Department))
    for d in depts_result.scalars().all():
        if not d.is_active:
            d.is_active = True
        dept_cache[d.code.strip().lower()] = d.id
        dept_cache[d.name.strip().lower()] = d.id
        dept_name_map[d.id] = d.name

    wps_result = await db.execute(select(Workplace))
    for w in wps_result.scalars().all():
        if not w.is_active:
            w.is_active = True
        wp_cache[w.code.strip().lower()] = w.id
        wp_cache[w.name.strip().lower()] = w.id

    positions_result = await db.execute(select(Position))
    for p in positions_result.scalars().all():
        if not p.is_active:
            p.is_active = True
        pos_cache[p.name.strip().lower()] = p.id
        pos_cache[p.code.strip().lower()] = p.id

    standard_depts_map = {
        "vp": ("VP", "Văn phòng"),
        "văn phòng": ("VP", "Văn phòng"),
        "p.qlda": ("P.QLDA", "Phòng Quản lý dự án"),
        "phòng quản lý dự án": ("P.QLDA", "Phòng Quản lý dự án"),
        "p.khtc": ("P.KHTC", "Phòng Kế hoạch - Tài chính"),
        "phòng kế hoạch - tài chính": ("P.KHTC", "Phòng Kế hoạch - Tài chính"),
        "p.ktmt": ("P.KTMT", "Phòng Kiểm tra Môi trường"),
        "phòng kiểm tra môi trường": ("P.KTMT", "Phòng Kiểm tra Môi trường"),
        "p.gsklh": ("P.GSKLH", "Phòng Giám sát Khu liên hợp"),
        "phòng giám sát khu liên hợp": ("P.GSKLH", "Phòng Giám sát Khu liên hợp"),
        "p.gskl": ("P.GSKL", "Phòng Giám sát Khối lượng"),
        "phòng giám sát khối lượng": ("P.GSKL", "Phòng Giám sát Khối lượng"),
        "bgd": ("BGD", "Ban Giám đốc"),
        "ban giám đốc": ("BGD", "Ban Giám đốc"),
    }

    auto_pos_code_map = {
        "chánh văn phòng": ("CVP", "department", True),
        "phó chánh văn phòng": ("PCVP", "department", True),
        "trưởng phòng": ("TP", "department", True),
        "q.trưởng phòng": ("QTP", "department", True),
        "phó trưởng phòng": ("PTP", "department", True),
        "chuyên viên": ("CV", "self", False),
        "kế toán viên": ("KTV", "self", False),
        "kế toán viên tc": ("KTVTC", "self", False),
        "cán sự": ("CS", "self", False),
    }

    for record in records:
        row = record.pop("_row")
        dept_code = str(record.pop("department_code", "") or "").strip()
        wp_code = record.pop("workplace_code", None)
        pos_text = str(record.get("position") or "").strip() or None
        cccd_val = str(record.pop("cccd_number", "") or "").strip() or None
        hire_date_raw = record.pop("hire_date", None)

        hire_date = None
        if hire_date_raw:
            if isinstance(hire_date_raw, datetime):
                hire_date = hire_date_raw.date()
            elif isinstance(hire_date_raw, str):
                for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                    try:
                        hire_date = datetime.strptime(hire_date_raw.strip(), fmt).date()
                        break
                    except ValueError:
                        continue
            elif hasattr(hire_date_raw, 'date'):
                hire_date = hire_date_raw.date()
            else:
                try:
                    hire_date = datetime.strptime(str(hire_date_raw).strip(), "%d/%m/%Y").date()
                except ValueError:
                    pass

        dept_key = dept_code.lower()
        dept_id = dept_cache.get(dept_key)
        if not dept_id and dept_key in standard_depts_map:
            std_code, std_name = standard_depts_map[dept_key]
            dept_id = dept_cache.get(std_code.lower()) or dept_cache.get(std_name.lower())
            if not dept_id:
                new_dept = Department(code=std_code, name=std_name, is_active=True)
                db.add(new_dept)
                await db.flush()
                dept_id = new_dept.id
                dept_cache[std_code.lower()] = dept_id
                dept_cache[std_name.lower()] = dept_id
                dept_name_map[dept_id] = std_name
        elif not dept_id and dept_code:
            gen_code = dept_code[:20].upper()
            new_dept = Department(code=gen_code, name=dept_code, is_active=True)
            db.add(new_dept)
            await db.flush()
            dept_id = new_dept.id
            dept_cache[dept_key] = dept_id
            dept_name_map[dept_id] = dept_code

        if not dept_id:
            errors.append(f"Dòng {row}: Phòng ban '{dept_code}' không tồn tại")
            continue

        wp_id = None
        if wp_code and str(wp_code).strip():
            wp_key = str(wp_code).strip().lower()
            wp_id = wp_cache.get(wp_key)
            if not wp_id and wp_key in ("mbs", "tsc", "trụ sở chính"):
                wp_id = wp_cache.get("tsc") or wp_cache.get("trụ sở chính")
                if not wp_id:
                    new_wp = Workplace(
                        code="TSC",
                        name="Trụ sở chính",
                        address="40 Võ Thị Sáu, phường Tân Định, TP.HCM",
                        is_office_hours=True,
                        is_active=True,
                    )
                    db.add(new_wp)
                    await db.flush()
                    wp_id = new_wp.id
                    wp_cache["tsc"] = wp_id
                    wp_cache["trụ sở chính"] = wp_id
                    wp_cache["mbs"] = wp_id

        pos_id = None
        if pos_text:
            pos_lower = pos_text.lower()
            pos_id = pos_cache.get(pos_lower)
            if not pos_id:
                if pos_lower in auto_pos_code_map:
                    p_code, p_scope, p_mgmt = auto_pos_code_map[pos_lower]
                else:
                    p_code = "".join(w[0].upper() for w in pos_text.split() if w)[:10] or "CV"
                    p_scope = "self"
                    p_mgmt = False
                existing_pos = await db.execute(select(Position).where(Position.code == p_code))
                found_p = existing_pos.scalar_one_or_none()
                if not found_p:
                    found_p = Position(
                        name=pos_text,
                        code=p_code,
                        scope=p_scope,
                        can_manage_employees=p_mgmt,
                        can_manage_settings=False,
                        can_manage_users=False,
                        can_view_reports=p_mgmt,
                        is_active=True,
                    )
                    db.add(found_p)
                    await db.flush()
                pos_cache[pos_lower] = found_p.id
                pos_cache[p_code.lower()] = found_p.id
                pos_id = found_p.id

        async with db.begin_nested():
            try:
                emp_code = str(record.get("employee_code") or "").strip() or None
                phone_val = str(record.get("phone") or "").strip() or None
                email_val = str(record.get("email") or "").strip() or None
                full_name_val = str(record.get("full_name") or "").strip()

                # Kiểm tra nếu nhân sự đã tồn tại theo Mã NV hoặc Email công vụ thì cập nhật (Upsert) tránh lỗi trùng
                existing_emp = None
                if emp_code:
                    res_e = await db.execute(select(Employee).where(Employee.employee_code == emp_code))
                    existing_emp = res_e.scalar_one_or_none()
                if not existing_emp and email_val:
                    res_e2 = await db.execute(select(Employee).where(Employee.email == email_val))
                    existing_emp = res_e2.scalar_one_or_none()

                if existing_emp:
                    emp = existing_emp
                    emp.department_id = dept_id
                    if wp_id:
                        emp.workplace_id = wp_id
                    if pos_id:
                        emp.position_id = pos_id
                    emp.full_name = full_name_val
                    if emp_code and not emp.employee_code:
                        emp.employee_code = emp_code
                    if pos_text:
                        emp.position = pos_text
                    if phone_val:
                        emp.phone = phone_val
                    if email_val:
                        emp.email = email_val
                    if hire_date:
                        emp.hire_date = hire_date
                    emp.is_active = True
                    await db.flush()
                else:
                    emp = Employee(
                        department_id=dept_id,
                        workplace_id=wp_id,
                        position_id=pos_id,
                        full_name=full_name_val,
                        employee_code=emp_code,
                        position=pos_text,
                        phone=phone_val,
                        email=email_val,
                        hire_date=hire_date,
                        is_active=True,
                    )
                    db.add(emp)
                    await db.flush()

                # Đồng bộ sang Hồ sơ Lý lịch Viên chức (vc_profiles) kèm Số Định danh CCCD, SĐT & Email công vụ
                res_vp = await db.execute(select(VcProfile).where(VcProfile.employee_id == emp.id))
                vc_prof = res_vp.scalar_one_or_none()
                if vc_prof:
                    vc_prof.birth_full_name = full_name_val.upper()
                    if cccd_val:
                        vc_prof.cccd_number = cccd_val
                    if emp_code:
                        vc_prof.official_file_code = emp_code
                    if phone_val:
                        vc_prof.personal_phone = phone_val
                    if email_val:
                        vc_prof.gov_email = email_val
                        if not vc_prof.personal_email:
                            vc_prof.personal_email = email_val
                    vc_prof.work_unit_name = dept_name_map.get(dept_id)
                    vc_prof.using_agency_name = dept_name_map.get(dept_id)
                    if pos_text:
                        vc_prof.professional_title_name = pos_text
                else:
                    vc_prof = VcProfile(
                        employee_id=emp.id,
                        birth_full_name=full_name_val.upper(),
                        cccd_number=cccd_val,
                        official_file_code=emp_code,
                        personal_phone=phone_val,
                        gov_email=email_val,
                        personal_email=email_val,
                        work_unit_name=dept_name_map.get(dept_id),
                        using_agency_name=dept_name_map.get(dept_id),
                        managing_agency_name="Ban Quản lý các Khu liên hợp xử lý chất thải Thành phố (MBS)",
                        professional_title_name=pos_text,
                    )
                    db.add(vc_prof)
                await db.flush()

                imported.append({
                    "row": row,
                    "full_name": emp.full_name,
                    "employee_code": emp.employee_code,
                    "id": str(emp.id),
                })
            except Exception as e:
                errors.append(f"Dòng {row}: {str(e)}")

    return {"imported": imported, "errors": errors}
