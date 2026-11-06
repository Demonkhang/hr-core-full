import logging
from datetime import date
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
    target_year = year or date.today().year
    token = current_user.get("_token", "")

    if employee_id:
        await LeaveService.get_or_create_balance(db, employee_id, target_year)
        await db.commit()
    elif year:
        created = await LeaveService.init_leave_balances(db, year, token=token)
        if created > 0:
            await db.commit()

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
    emp_map = await hr_client.get_employees_batch(emp_ids, token=token) if emp_ids else {}

    years = list(set(b.year for b in balances))
    stats_by_year: dict[int, dict[str, dict[str, float]]] = {}
    dirty = False
    for yr in years:
        stats_by_year[yr] = await LeaveService.get_year_leave_stats_map(db, yr, emp_ids if emp_ids else None)

    for b in balances:
        emp_stats = stats_by_year.get(b.year, {}).get(str(b.employee_id), {})
        actual_used = round(float(emp_stats.get("annual_approved_days", 0.0)), 1)
        if round(float(b.used or 0.0), 1) != actual_used:
            b.used = actual_used
            b.remaining = round(float(b.total_allocated or 0.0) + float(b.carried_over or 0.0) - actual_used, 1)
            dirty = True

    if dirty:
        await db.commit()

    items: List[LeaveBalanceResponse] = []
    for b in balances:
        emp = emp_map.get(str(b.employee_id))
        if department_id:
            emp_dept_id = str(emp.get("department_id")) if emp and emp.get("department_id") else None
            if emp_dept_id not in department_id:
                continue
        emp_stats = stats_by_year.get(b.year, {}).get(str(b.employee_id), {})
        items.append(build_leave_balance_response(b, emp=emp, stats=emp_stats))

    items.sort(key=lambda x: (x.employee_name or "").lower())
    return items


@router.get("/employee/{employee_id}/year/{year}", response_model=LeaveBalanceResponse)
async def get_employee_leave_balance(
    employee_id: str,
    year: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    balance = await LeaveService.get_or_create_balance(db, employee_id, year)
    stats_map = await LeaveService.get_year_leave_stats_map(db, year, [employee_id])
    emp_stats = stats_map.get(str(employee_id), {})
    actual_used = round(float(emp_stats.get("annual_approved_days", 0.0)), 1)
    if round(float(balance.used or 0.0), 1) != actual_used:
        balance.used = actual_used
        balance.remaining = round(float(balance.total_allocated or 0.0) + float(balance.carried_over or 0.0) - actual_used, 1)
    await db.commit()

    result = await db.execute(
        select(LeaveBalance).where(LeaveBalance.id == balance.id)
    )
    balance = result.scalar_one()
    emp = await hr_client.get_employee(employee_id, token=token)
    return build_leave_balance_response(balance, emp, stats=emp_stats)


@router.post("/init", status_code=200)
async def init_balances(
    year: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_leave')),
):
    token = current_user.get("_token", "")
    count = await LeaveService.init_leave_balances(db, year, token=token)
    await db.commit()
    return {
        "message": f"Đã khởi tạo thành công {count} quỹ phép năm {year}",
        "created_count": count
    }


@router.post("/carry-over", status_code=200)
async def carry_over_balances(
    year: int = Query(..., description="Năm đích nhận phép kết chuyển"),
    max_days: float = Query(5.0, ge=0.0, le=30.0, description="Số ngày tối đa được kết chuyển"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_leave')),
):
    token = current_user.get("_token", "")
    updated = await LeaveService.carry_over_leave_balances(db, target_year=year, max_carry_over=max_days, token=token)
    await db.commit()
    return {
        "message": f"Đã kết chuyển phép tồn năm {year - 1} sang năm {year} cho {updated} nhân sự (Tối đa {max_days} ngày/người)",
        "updated_count": updated,
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
    emp_id_str = str(balance.employee_id)
    emp = await hr_client.get_employee(emp_id_str, token=current_user.get("_token", ""))
    stats_map = await LeaveService.get_year_leave_stats_map(db, balance.year, [emp_id_str])
    return build_leave_balance_response(balance, emp, stats=stats_map.get(emp_id_str, {}))
