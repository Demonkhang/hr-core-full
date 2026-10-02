from fastapi import APIRouter
from app.api.v1.employees.crud import router as crud_router
from app.api.v1.employees.import_export import router as import_export_router
from app.api.v1.employees.accounts import router as accounts_router
from app.api.v1.employees.batch_operations import router as batch_router

router = APIRouter()
router.include_router(import_export_router, prefix="/employees")
router.include_router(accounts_router, prefix="/employees")
router.include_router(batch_router, prefix="/employees")
router.include_router(crud_router, prefix="/employees")
