import re
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from app.models.employee import Employee
from app.models.department import Department
from app.models.training import Training


async def get_dashboard_stats(
    db: AsyncSession,
    department_ids: Optional[List[str]] = None,
) -> dict:
    emp_base = select(Employee.id)
    if department_ids:
        emp_base = emp_base.where(Employee.department_id.in_(department_ids))

    total_query = select(func.count()).select_from(emp_base.subquery())
    total_employees = (await db.execute(total_query)).scalar() or 0

    active_query = select(func.count()).select_from(
        emp_base.where(Employee.is_active == True).subquery()
    )
    active_employees = (await db.execute(active_query)).scalar() or 0

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
    }


async def get_department_distribution(
    db: AsyncSession,
    department_ids: Optional[List[str]] = None,
) -> List[dict]:
    query = select(
        Department.id,
        Department.name,
        func.count(Employee.id).label("employee_count"),
    ).outerjoin(
        Employee, and_(Employee.department_id == Department.id, Employee.is_active == True)
    ).group_by(Department.id, Department.name).order_by(Department.name)

    if department_ids:
        query = query.where(Department.id.in_(department_ids))

    result = await db.execute(query)
    return [
        {
            "department_id": str(row.id),
            "department_name": row.name,
            "employee_count": row.employee_count,
        }
        for row in result
    ]


def _classify_degree(name: str) -> str:
    name_lower = name.lower()
    if re.search(r'tiến sĩ|ts\.?\s|doctor', name_lower):
        return "Tiến sĩ"
    if re.search(r'thạc sĩ|ths\.?\s|master', name_lower):
        return "Thạc sĩ"
    if re.search(r'cử nhân|kỹ sư|bác sĩ|đại học|cđha|cđk|bachelor', name_lower):
        return "Đại học"
    if re.search(r'cao đẳng|college', name_lower):
        return "Cao đẳng"
    if re.search(r'trung cấp|trung cap|intermediate', name_lower):
        return "Trung cấp"
    return "Khác"


async def get_qualification_distribution(
    db: AsyncSession,
    department_ids: Optional[List[str]] = None,
) -> List[dict]:
    from sqlalchemy import text

    emp_query = select(Employee.id)
    if department_ids:
        emp_query = emp_query.where(Employee.department_id.in_(department_ids))

    trainings = await db.execute(
        select(Training.employee_id, Training.name)
        .where(
            Training.employee_id.in_(emp_query.subquery()),
            Training.credential_type == "degree",
        )
        .order_by(Training.employee_id, Training.issue_date.desc())
    )
    rows = trainings.all()

    emp_highest: dict = {}
    for emp_id, name in rows:
        if emp_id not in emp_highest:
            emp_highest[emp_id] = name

    counts: dict = {}
    for name in emp_highest.values():
        level = _classify_degree(name)
        counts[level] = counts.get(level, 0) + 1

    return [
        {"level": level, "count": count}
        for level, count in sorted(counts.items(), key=lambda x: -x[1])
    ]
