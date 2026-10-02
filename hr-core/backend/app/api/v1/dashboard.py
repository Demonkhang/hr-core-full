from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, get_scope_filter
from app.models.user import User
from app.services import dashboard_service

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    department_id: Optional[List[str]] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    scope_filter = get_scope_filter(perms, current_user)
    effective_departments = [scope_filter["department_id"]] if scope_filter["department_id"] else department_id

    stats = await dashboard_service.get_dashboard_stats(db, department_ids=effective_departments)
    dist = await dashboard_service.get_department_distribution(db, department_ids=effective_departments)
    qual_dist = await dashboard_service.get_qualification_distribution(db, department_ids=effective_departments)

    return {
        "stats": stats,
        "department_distribution": dist,
        "qualification_distribution": qual_dist,
    }
