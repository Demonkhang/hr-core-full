import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission
from app.api.v1.helpers import build_leave_balance_response
from app.schemas.leave_balance import LeaveBalanceUpdate, LeaveBalanceResponse
from app.models.leave_balance import LeaveBalance
from app.core.exceptions import NotFoundError, ForbiddenError
from app.services.leave_service import LeaveService
from app.clients.hr_client import hr_client

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[LeaveBalanceResponse])
async def list_leave_balances(
    employee_id: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    department_id: Optional[List[str]] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query = select(LeaveBalance)
    if active_only:
        query = query.where(LeaveBalance.is_active == True)
    if employee_id:
        query = query.where(LeaveBalance.employee_id == employee_id)
    if year:
        query = query.where(LeaveBalance.year == year)

    query = query.order_by(LeaveBalance.year.desc())
    result = await db.execute(query)
    balances = result.scalars().all()

    emp_ids = list(set(str(b.employee_id) for b in balances))
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    return [
        build_leave_balance_response(b, emp=emp_map.get(str(b.employee_id)))
        for b in balances
    ]


@router.get("/employee/{employee_id}/year/{year}", response_model=LeaveBalanceResponse)
async def get_employee_leave_balance(
    employee_id: str,
    year: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    balance = await LeaveService.get_or_create_balance(db, employee_id, year)
    result = await db.execute(
        select(LeaveBalance).where(LeaveBalance.id == balance.id)
    )
    balance = result.scalar_one()
    emp = await hr_client.get_employee(employee_id)
    return build_leave_balance_response(balance, emp)


@router.post("/init", status_code=200)
async def init_balances(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_leave')),
):
    count = await LeaveService.init_leave_balances(db, year)
    await db.commit()
    return {
        "message": f"Đã khởi tạo thành công {count} quỹ phép năm {year}",
        "created_count": count
    }


@router.put("/{balance_id}", response_model=LeaveBalanceResponse)
async def update_leave_balance(
    balance_id: str,
    body: LeaveBalanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_leave')),
):
    balance = await db.get(LeaveBalance, balance_id)
    if not balance:
        raise NotFoundError(detail="Không tìm thấy quỹ phép")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(balance, key, value)

    balance.remaining = balance.total_allocated + balance.carried_over - balance.used

    await db.commit()

    result = await db.execute(
        select(LeaveBalance).where(LeaveBalance.id == balance_id)
    )
    balance = result.scalar_one()
    emp = await hr_client.get_employee(str(balance.employee_id))
    return build_leave_balance_response(balance, emp)
