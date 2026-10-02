from fastapi import APIRouter, Depends, Request, Query
from typing import Optional
from app.api.deps import get_current_user
from app.clients.hr_client import hr_client


router = APIRouter()


@router.get("/employees/{employee_id}")
async def proxy_get_employee(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_employee(employee_id) or {"error": "Not found"}


@router.get("/employees/{employee_id}/detail")
async def proxy_get_employee_detail(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_employee(employee_id) or {"error": "Not found"}


@router.get("/employees")
async def proxy_list_employees(
    active_only: Optional[bool] = Query(True),
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    return await hr_client.get_employees(active_only=active_only, token=token)


@router.get("/departments")
async def proxy_list_departments(
    active_only: Optional[bool] = Query(True),
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    try:
        from httpx import AsyncClient
        async with AsyncClient(timeout=10) as client:
            from app.config import settings
            params = {"active_only": "true" if active_only else "false"}
            resp = await client.get(
                f"{settings.HR_CORE_BASE_URL}/api/v1/departments",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
            if resp.status_code == 200:
                return resp.json()
            return []
    except Exception:
        return []


@router.get("/departments/{department_id}")
async def proxy_get_department(
    department_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_department(department_id) or {"error": "Not found"}


@router.get("/workplaces")
async def proxy_list_workplaces(
    current_user: dict = Depends(get_current_user),
):
    token = current_user.get("_token", "")
    try:
        from httpx import AsyncClient
        async with AsyncClient(timeout=10) as client:
            from app.config import settings
            resp = await client.get(
                f"{settings.HR_CORE_BASE_URL}/api/v1/workplaces",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json()
            return []
    except Exception:
        return []


@router.get("/workplaces/{workplace_id}")
async def proxy_get_workplace(
    workplace_id: str,
    current_user: dict = Depends(get_current_user),
):
    return await hr_client.get_workplace(workplace_id) or {"error": "Not found"}
