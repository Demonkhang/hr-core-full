from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.schemas.salary_history import (
    SalaryHistoryCreate, SalaryHistoryUpdate, SalaryHistoryResponse,
)
from app.models.employee import Employee
from app.models.salary_history import SalaryHistory
from app.models.user import User
from app.core.exceptions import NotFoundError
from app.core.constants import RESPONSE_MESSAGES

router = APIRouter()


async def _get_employee(emp_id: str, db: AsyncSession) -> Employee:
    emp = await db.get(Employee, emp_id)
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])
    return emp


def _build_response(sh: SalaryHistory, employee_name: str = None) -> SalaryHistoryResponse:
    return SalaryHistoryResponse(
        id=str(sh.id),
        employee_id=str(sh.employee_id),
        coefficient=sh.coefficient,
        allowance_coefficient=sh.allowance_coefficient,
        effective_date=sh.effective_date,
        decision_number=sh.decision_number,
        notes=sh.notes,
        employee_name=employee_name,
        created_at=sh.created_at,
        updated_at=sh.updated_at,
    )


@router.get(
    "/salary-history",
    response_model=List[SalaryHistoryResponse],
)
async def list_all_salary_history(
    employee_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(SalaryHistory)
    if employee_id:
        query = query.where(SalaryHistory.employee_id == employee_id)
    query = query.order_by(SalaryHistory.effective_date.desc())
    result = await db.execute(query)
    records = result.scalars().all()

    emp_ids = list({str(r.employee_id) for r in records})
    name_map = {}
    if emp_ids:
        emps_result = await db.execute(select(Employee).where(Employee.id.in_(emp_ids)))
        for e in emps_result.scalars().all():
            name_map[str(e.id)] = e.full_name

    return [_build_response(r, name_map.get(str(r.employee_id))) for r in records]


@router.get(
    "/employees/{emp_id}/salary-history",
    response_model=List[SalaryHistoryResponse],
)
async def list_salary_history(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = await _get_employee(emp_id, db)
    result = await db.execute(
        select(SalaryHistory)
        .where(SalaryHistory.employee_id == emp_id)
        .order_by(SalaryHistory.effective_date.desc())
    )
    records = result.scalars().all()
    return [_build_response(r, emp.full_name) for r in records]


@router.post(
    "/employees/{emp_id}/salary-history",
    response_model=SalaryHistoryResponse,
    status_code=201,
)
async def create_salary_history(
    emp_id: str,
    body: SalaryHistoryCreate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_employees")),
):
    emp = await _get_employee(emp_id, db)
    record = SalaryHistory(
        employee_id=emp.id,
        coefficient=body.coefficient,
        allowance_coefficient=body.allowance_coefficient,
        effective_date=body.effective_date,
        decision_number=body.decision_number,
        notes=body.notes,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _build_response(record, emp.full_name)


@router.put(
    "/employees/{emp_id}/salary-history/{record_id}",
    response_model=SalaryHistoryResponse,
)
async def update_salary_history(
    emp_id: str,
    record_id: str,
    body: SalaryHistoryUpdate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_employees")),
):
    emp = await _get_employee(emp_id, db)
    result = await db.execute(
        select(SalaryHistory).where(
            SalaryHistory.id == record_id,
            SalaryHistory.employee_id == emp_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError(detail="Không tìm thấy bản ghi quá trình lương")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    await db.commit()
    await db.refresh(record)
    return _build_response(record, emp.full_name)


@router.delete(
    "/employees/{emp_id}/salary-history/{record_id}",
    status_code=204,
)
async def delete_salary_history(
    emp_id: str,
    record_id: str,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_employees")),
):
    result = await db.execute(
        select(SalaryHistory).where(
            SalaryHistory.id == record_id,
            SalaryHistory.employee_id == emp_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError(detail="Không tìm thấy bản ghi quá trình lương")

    await db.delete(record)
    await db.commit()
