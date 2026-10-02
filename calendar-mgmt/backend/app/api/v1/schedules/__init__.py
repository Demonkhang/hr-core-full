from fastapi import APIRouter
from app.api.v1.schedules.calendar import router as calendar_router
from app.api.v1.schedules.crud import router as crud_router
from app.api.v1.schedules.workflow import router as workflow_router

router = APIRouter()
router.include_router(calendar_router, prefix="/schedules")
router.include_router(crud_router, prefix="/schedules")
router.include_router(workflow_router, prefix="/schedules")
