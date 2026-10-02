import asyncio
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission
from app.schemas.shift_template import ShiftTemplateCreate, ShiftTemplateUpdate, ShiftTemplateResponse
from app.models.shift_template import ShiftTemplate
from app.core.exceptions import NotFoundError
from app.clients.hr_client import hr_client

router = APIRouter()


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    return auth.replace("Bearer ", "", 1) if auth.startswith("Bearer ") else ""


async def _resolve_workplace_names(wp_ids: list[str], token: str) -> dict[str, str]:
    if not wp_ids:
        return {}
    results = await asyncio.gather(*[hr_client.get_workplace(wid, token=token) for wid in wp_ids])
    return {wid: wp.get("name", "") for wid, wp in zip(wp_ids, results) if wp}


async def _resolve_department_names(dept_ids: list[str], token: str) -> dict[str, str]:
    if not dept_ids:
        return {}
    results = await asyncio.gather(*[hr_client.get_department(did, token=token) for did in dept_ids])
    return {did: dept.get("name", "") for did, dept in zip(dept_ids, results) if dept}


def _to_response(t: ShiftTemplate, wp_map: dict[str, str], dept_map: dict[str, str]) -> ShiftTemplateResponse:
    t_dept_ids = [str(d) for d in (t.department_ids or [])]
    t_wp_id = str(t.workplace_id)
    return ShiftTemplateResponse(
        id=str(t.id),
        workplace_id=t_wp_id,
        department_ids=t_dept_ids,
        name=t.name,
        start_time=t.start_time,
        end_time=t.end_time,
        is_overnight=t.is_overnight,
        color=t.color,
        is_active=t.is_active,
        workplace_name=wp_map.get(t_wp_id),
        department_names=[dept_map.get(did, "") for did in t_dept_ids],
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("", response_model=list[ShiftTemplateResponse])
async def list_shift_templates(
    request: Request,
    workplace_id: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    query = select(ShiftTemplate)
    if active_only:
        query = query.where(ShiftTemplate.is_active == True)
    if workplace_id:
        query = query.where(ShiftTemplate.workplace_id == workplace_id)
    query = query.order_by(ShiftTemplate.workplace_id, ShiftTemplate.start_time)

    result = await db.execute(query)
    templates = result.scalars().all()

    token = _extract_token(request)
    wp_ids = list(set(str(t.workplace_id) for t in templates if t.workplace_id))
    all_dept_ids = [str(d) for t in templates for d in (t.department_ids or [])]
    dept_ids = list(set(all_dept_ids))
    wp_map = await _resolve_workplace_names(wp_ids, token)
    dept_map = await _resolve_department_names(dept_ids, token)

    return [_to_response(t, wp_map, dept_map) for t in templates]


@router.get("/{template_id}", response_model=ShiftTemplateResponse)
async def get_shift_template(
    request: Request,
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        tpl_uuid = UUID(template_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy ca làm việc")
    result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == tpl_uuid)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundError(detail="Không tìm thấy ca làm việc")
    token = _extract_token(request)
    t_dept_ids = [str(d) for d in (t.department_ids or [])]
    wp_map = await _resolve_workplace_names([str(t.workplace_id)], token)
    dept_map = await _resolve_department_names(t_dept_ids, token)
    return _to_response(t, wp_map, dept_map)


@router.post("", response_model=ShiftTemplateResponse, status_code=201)
async def create_shift_template(
    request: Request,
    body: ShiftTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_create_schedule')),
):
    template = ShiftTemplate(**body.model_dump())
    db.add(template)
    await db.commit()
    await db.refresh(template)

    token = _extract_token(request)
    wp_map = await _resolve_workplace_names([str(template.workplace_id)], token)
    dept_map = await _resolve_department_names(body.department_ids, token)
    return _to_response(template, wp_map, dept_map)


@router.put("/{template_id}", response_model=ShiftTemplateResponse)
async def update_shift_template(
    request: Request,
    template_id: str,
    body: ShiftTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_update_schedule')),
):
    try:
        tpl_uuid = UUID(template_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy ca làm việc")
    result = await db.execute(select(ShiftTemplate).where(ShiftTemplate.id == tpl_uuid))
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundError(detail="Không tìm thấy ca làm việc")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(t, key, value)

    await db.commit()
    await db.refresh(t)
    token = _extract_token(request)
    t_dept_ids = body.department_ids if body.department_ids is not None else [str(d) for d in (t.department_ids or [])]
    wp_map = await _resolve_workplace_names([str(t.workplace_id)], token)
    dept_map = await _resolve_department_names(t_dept_ids, token)
    return _to_response(t, wp_map, dept_map)


@router.delete("/{template_id}")
async def delete_shift_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_delete_schedule')),
):
    try:
        tpl_uuid = UUID(template_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy ca làm việc")
    result = await db.execute(select(ShiftTemplate).where(ShiftTemplate.id == tpl_uuid))
    t = result.scalar_one_or_none()
    if not t:
        raise NotFoundError(detail="Không tìm thấy ca làm việc")
    t.is_active = False
    await db.commit()
    return {"message": "Đã vô hiệu hóa ca làm việc"}
