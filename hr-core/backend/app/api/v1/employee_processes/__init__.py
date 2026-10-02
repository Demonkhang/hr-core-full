from fastapi import APIRouter
from app.api.v1.employee_processes.base_salary_config import router as base_salary_config_router
from app.api.v1.employee_processes.salary_history import router as salary_history_router
from app.api.v1.employee_processes.qualifications import router as qualifications_router

router = APIRouter()
router.include_router(base_salary_config_router)
router.include_router(salary_history_router)
router.include_router(qualifications_router)
