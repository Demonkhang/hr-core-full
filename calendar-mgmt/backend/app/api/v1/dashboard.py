from datetime import date
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.core.exceptions import ValidationError
from app.services import dashboard_service

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    month: Optional[str] = Query(None),
    department_id: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_read_schedule')),
):
    month_date = None
    if month:
        try:
            year, m = map(int, month.split("-"))
            month_date = date(year, m, 1)
        except ValueError:
            raise ValidationError(detail="Định dạng tháng không hợp lệ. Sử dụng YYYY-MM")

    token = current_user.get("_token", "")
    stats = await dashboard_service.get_dashboard_stats(db, month=month_date, department_ids=department_id, token=token)
    dist = await dashboard_service.get_department_distribution(db, department_ids=department_id, token=token)
    trend = await dashboard_service.get_monthly_trend(db, month=month_date, department_ids=department_id, token=token)
    sched_status = await dashboard_service.get_schedule_by_status(db, month=month_date, department_ids=department_id, token=token)
    ot_dept = await dashboard_service.get_overtime_by_department(db, month=month_date, department_ids=department_id, token=token)

    return {
        "stats": stats,
        "department_distribution": dist,
        "monthly_trend": trend,
        "schedule_by_status": sched_status,
        "overtime_by_department": ot_dept,
    }
