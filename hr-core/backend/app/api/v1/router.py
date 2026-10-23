from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.departments import router as departments_router
from app.api.v1.positions import router as positions_router
from app.api.v1.job_positions import router as job_positions_router
from app.api.v1.workplaces import router as workplaces_router
from app.api.v1.employees import router as employees_router
from app.api.v1.employee_processes import router as employee_processes_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.audit_logs import router as audit_logs_router
from app.api.v1.payroll import router as payroll_router
from app.api.v1.contracts import router as contracts_router


api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(departments_router, prefix="/departments", tags=["Departments"])
api_router.include_router(positions_router, prefix="/positions", tags=["Positions"])
api_router.include_router(job_positions_router, prefix="/job-positions", tags=["Job Positions"])
api_router.include_router(workplaces_router, prefix="/workplaces", tags=["Workplaces"])
api_router.include_router(employees_router, tags=["Employees"])
api_router.include_router(employee_processes_router, tags=["Employee Processes"])
api_router.include_router(contracts_router, prefix="/contracts", tags=["Contracts"])
api_router.include_router(dashboard_router, prefix="/reports", tags=["Dashboard"])
api_router.include_router(audit_logs_router, prefix="/audit-logs", tags=["Audit Logs"])
api_router.include_router(payroll_router, prefix="/payroll", tags=["Payroll"])


