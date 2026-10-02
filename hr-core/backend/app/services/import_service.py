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


REQUIRED_COLUMNS = [
    "full_name", "department_code",
]

OPTIONAL_COLUMNS = [
    "employee_code", "position", "phone", "email",
    "workplace_code", "hire_date",
]

ALL_COLUMNS = REQUIRED_COLUMNS + [c for c in OPTIONAL_COLUMNS if c not in REQUIRED_COLUMNS]

COLUMN_MAP = {
    "Mã NV": "employee_code",
    "Họ tên": "full_name",
    "Phòng ban": "department_code",
    "Chức vụ": "position",
    "Nơi làm việc": "workplace_code",
    "Ngày vào làm": "hire_date",
    "SĐT": "phone",
    "Email": "email",
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
    wp_cache: Dict[str, UUID] = {}
    pos_cache: Dict[str, UUID] = {}

    depts_result = await db.execute(select(Department).where(Department.is_active == True))
    for d in depts_result.scalars().all():
        dept_cache[d.code] = d.id

    wps_result = await db.execute(select(Workplace).where(Workplace.is_active == True))
    for w in wps_result.scalars().all():
        wp_cache[w.code] = w.id

    positions_result = await db.execute(select(Position).where(Position.is_active == True))
    for p in positions_result.scalars().all():
        pos_cache[p.name.lower()] = p.id
        pos_cache[p.code.lower()] = p.id

    for record in records:
        row = record.pop("_row")
        dept_code = record.pop("department_code", "")
        wp_code = record.pop("workplace_code", None)
        pos_text = record.get("position")
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

        dept_id = dept_cache.get(dept_code)
        if not dept_id:
            errors.append(f"Dòng {row}: Mã bộ phận '{dept_code}' không tồn tại")
            continue

        wp_id = None
        if wp_code:
            wp_id = wp_cache.get(wp_code)
            if not wp_id:
                errors.append(f"Dòng {row}: Mã nơi làm việc '{wp_code}' không tồn tại")
                continue

        pos_id = None
        if pos_text:
            pos_id = pos_cache.get(pos_text.strip().lower())

        async with db.begin_nested():
            try:
                emp = Employee(
                    department_id=dept_id,
                    workplace_id=wp_id,
                    position_id=pos_id,
                    full_name=record.get("full_name", ""),
                    employee_code=record.get("employee_code"),
                    position=pos_text,
                    phone=record.get("phone"),
                    email=record.get("email"),
                    hire_date=hire_date,
                )
                db.add(emp)
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
