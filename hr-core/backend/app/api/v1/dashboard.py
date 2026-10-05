import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, get_scope_filter
from app.models.user import User
from app.services import dashboard_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    department_id: Optional[List[str]] = Query(None),
    capacity_filter: Optional[str] = Query(None), # 'all', 'available', 'full'
    qual_source: Optional[str] = Query('auto'), # 'auto', 'employee', 'job_position'
    action_type: Optional[str] = Query(None),
    include_empty: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(get_current_permissions),
):
    scope_filter = get_scope_filter(perms, current_user)
    effective_departments = [scope_filter["department_id"]] if scope_filter["department_id"] else department_id

    try:
        stats = await dashboard_service.get_dashboard_stats(db, department_ids=effective_departments)
    except Exception:
        logger.exception("Error loading dashboard stats")
        stats = {}

    try:
        dept_dist = await dashboard_service.get_department_distribution(db, department_ids=effective_departments, include_empty=include_empty)
    except Exception:
        logger.exception("Error loading department distribution")
        dept_dist = []

    try:
        wp_dist = await dashboard_service.get_workplace_distribution(db, department_ids=effective_departments)
    except Exception:
        logger.exception("Error loading workplace distribution")
        wp_dist = []

    try:
        qual_dist = await dashboard_service.get_qualification_distribution(db, department_ids=effective_departments, source=qual_source or 'auto')
    except Exception:
        logger.exception("Error loading qualification distribution")
        qual_dist = []

    try:
        headcount_capacity = await dashboard_service.get_job_position_capacity(db, capacity_filter=capacity_filter)
    except Exception:
        logger.exception("Error loading headcount capacity")
        headcount_capacity = []

    try:
        recent_activities = await dashboard_service.get_recent_activities(db, action_type=action_type, limit=8)
    except Exception:
        logger.exception("Error loading recent activities")
        recent_activities = []

    try:
        recent_hires = await dashboard_service.get_recent_hires(db, limit=5)
    except Exception:
        logger.exception("Error loading recent hires")
        recent_hires = []

    return {
        "stats": stats,
        "department_distribution": dept_dist,
        "workplace_distribution": wp_dist,
        "qualification_distribution": qual_dist,
        "headcount_capacity": headcount_capacity,
        "recent_activities": recent_activities,
        "recent_hires": recent_hires,
    }
