import re
import logging
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.models.employee import Employee
from app.models.department import Department
from app.models.workplace import Workplace
from app.models.job_position import JobPosition
from app.models.training import Training
from app.models.user import User
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)


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
    inactive_employees = total_employees - active_employees

    dept_query = select(func.count(Department.id)).where(Department.is_active == True)
    total_departments = (await db.execute(dept_query)).scalar() or 0

    wp_query = select(func.count(Workplace.id)).where(Workplace.is_active == True)
    total_workplaces = (await db.execute(wp_query)).scalar() or 0

    jp_query = select(func.count(JobPosition.id)).where(JobPosition.is_active == True)
    total_job_positions = (await db.execute(jp_query)).scalar() or 0

    account_query = select(func.count(User.id)).where(User.employee_id.isnot(None))
    account_count = (await db.execute(account_query)).scalar() or 0

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "inactive_employees": inactive_employees,
        "total_departments": total_departments,
        "total_workplaces": total_workplaces,
        "total_job_positions": total_job_positions,
        "account_count": account_count,
    }


async def get_department_distribution(
    db: AsyncSession,
    department_ids: Optional[List[str]] = None,
    include_empty: bool = True,
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
    rows = result.all()
    if not include_empty:
        rows = [r for r in rows if r.employee_count > 0]

    return [
        {
            "department_id": str(row.id),
            "department_name": row.name,
            "employee_count": row.employee_count,
        }
        for row in rows
    ]


async def get_workplace_distribution(
    db: AsyncSession,
    department_ids: Optional[List[str]] = None,
) -> List[dict]:
    wps_result = await db.execute(select(Workplace).where(Workplace.is_active == True).order_by(Workplace.name))
    workplaces = wps_result.scalars().all()

    emp_query = select(Employee).options(selectinload(Employee.job_position)).where(Employee.is_active == True)
    if department_ids:
        emp_query = emp_query.where(Employee.department_id.in_(department_ids))

    emp_result = await db.execute(emp_query)
    employees = emp_result.scalars().all()

    result = []
    for wp in workplaces:
        count = 0
        for e in employees:
            # Employee workplace is either direct or inherited from JobPosition.workplace_id
            effective_wp_id = e.workplace_id or (e.job_position.workplace_id if e.job_position else None)
            if effective_wp_id and str(effective_wp_id) == str(wp.id):
                count += 1
        result.append({
            "workplace_id": str(wp.id),
            "workplace_name": wp.name,
            "employee_count": count,
        })

    # Sort so workplaces with employees appear first
    result.sort(key=lambda x: (-x["employee_count"], x["workplace_name"]))
    return result


async def get_job_position_capacity(
    db: AsyncSession,
    department_id: Optional[str] = None,
    capacity_filter: Optional[str] = None, # 'all', 'available', 'full'
) -> List[dict]:
    query = (
        select(JobPosition)
        .options(
            selectinload(JobPosition.employees),
            selectinload(JobPosition.workplace),
        )
        .where(JobPosition.is_active == True)
        .order_by(JobPosition.name)
    )

    result = await db.execute(query)
    jps = result.scalars().all()

    data = []
    for j in jps:
        current_headcount = len([e for e in j.employees if e.is_active])

        if capacity_filter == 'full' and current_headcount < j.max_headcount:
            continue
        if capacity_filter == 'available' and current_headcount >= j.max_headcount:
            continue

        data.append({
            "id": str(j.id),
            "name": j.name,
            "department_name": j.workplace.name if j.workplace else None,
            "professional_level": j.professional_level,
            "current_headcount": current_headcount,
            "max_headcount": j.max_headcount,
        })

    # Sort positions with active headcount first, then by name
    data.sort(key=lambda x: (-x["current_headcount"], x["name"]))
    return data[:8]


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
    source: str = "auto", # 'auto', 'employee', 'job_position'
) -> List[dict]:
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

    if (source == "employee" or source == "auto") and rows:
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

    # Fallback to JobPosition required_qualification_level distribution
    jp_query = select(JobPosition.required_qualification_level, func.count(JobPosition.id)).where(
        JobPosition.is_active == True,
        JobPosition.required_qualification_level.isnot(None),
    ).group_by(JobPosition.required_qualification_level)

    jp_result = await db.execute(jp_query)
    jp_rows = jp_result.all()

    return [
        {"level": row[0] or "Chưa xác định", "count": row[1]}
        for row in sorted(jp_rows, key=lambda x: -x[1])
    ]


async def get_recent_activities(
    db: AsyncSession,
    action_type: Optional[str] = None,
    limit: int = 8,
) -> List[dict]:
    query = (
        select(AuditLog)
        .options(selectinload(AuditLog.user))
        .order_by(AuditLog.created_at.desc())
    )
    if action_type:
        query = query.where(AuditLog.action.ilike(f"%{action_type}%"))

    query = query.limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "user_name": log.user.full_name if log.user else "Hệ thống",
            "user_username": log.user.username if log.user else None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "success": log.success,
        }
        for log in logs
    ]


async def get_recent_hires(
    db: AsyncSession,
    limit: int = 5,
) -> List[dict]:
    query = (
        select(Employee)
        .options(selectinload(Employee.department), selectinload(Employee.position_rel))
        .where(Employee.is_active == True)
        .order_by(Employee.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    employees = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "full_name": e.full_name,
            "employee_code": e.employee_code,
            "department_name": e.department.name if e.department else None,
            "position_name": e.position_rel.name if e.position_rel else e.position,
            "hire_date": e.hire_date.isoformat() if e.hire_date else None,
        }
        for e in employees
    ]
