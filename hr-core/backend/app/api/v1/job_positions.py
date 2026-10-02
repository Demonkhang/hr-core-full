from typing import Optional, List, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from app.core.exceptions import NotFoundError, BadRequestError, ConflictError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.schemas.job_position import JobPositionCreate, JobPositionUpdate, JobPositionResponse
from app.models.user import User
from app.models.job_position import JobPosition
from app.models.employee import Employee
from app.services.audit_service import create_audit_log

router = APIRouter()


async def _build_response(db: AsyncSession, jp: JobPosition, current_headcount: int) -> JobPositionResponse:
    return JobPositionResponse(
        id=str(jp.id),
        name=jp.name,
        code=jp.code,
        description=jp.description,
        professional_level=jp.professional_level,
        required_qualification_level=jp.required_qualification_level,
        required_specialty=jp.required_specialty,
        max_headcount=jp.max_headcount,
        is_active=jp.is_active,
        current_headcount=current_headcount,
        created_at=jp.created_at,
        updated_at=jp.updated_at,
    )


@router.get("", response_model=List[JobPositionResponse])
async def list_job_positions(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(JobPosition)
    if active_only:
        query = query.where(JobPosition.is_active == True)
    query = query.order_by(JobPosition.professional_level, JobPosition.name)
    result = await db.execute(query)
    job_positions = result.scalars().all()

    headcounts: Dict[str, int] = {}
    count_result = await db.execute(
        select(Employee.job_position_id, func.count(Employee.id))
        .where(Employee.is_active == True, Employee.job_position_id.isnot(None))
        .group_by(Employee.job_position_id)
    )
    for jp_id, cnt in count_result:
        headcounts[str(jp_id)] = cnt

    return [
        await _build_response(db, jp, headcounts.get(str(jp.id), 0))
        for jp in job_positions
    ]


@router.get("/{jp_id}", response_model=JobPositionResponse)
async def get_job_position(
    jp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        jp_uuid = UUID(jp_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy vị trí việc làm")
    result = await db.execute(select(JobPosition).where(JobPosition.id == jp_uuid))
    jp = result.scalar_one_or_none()
    if not jp:
        raise NotFoundError(detail="Không tìm thấy vị trí việc làm")

    emp_count_result = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.job_position_id == jp_uuid, Employee.is_active == True)
    )
    emp_count = emp_count_result.scalar() or 0

    return await _build_response(db, jp, emp_count)


@router.post("", response_model=JobPositionResponse, status_code=201)
async def create_job_position(
    body: JobPositionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_settings')),
):
    existing = await db.execute(select(JobPosition).where(JobPosition.code == body.code))
    if existing.scalar_one_or_none():
        raise ConflictError(detail="Mã vị trí việc làm đã tồn tại")

    jp = JobPosition(**body.model_dump())
    db.add(jp)
    await db.flush()
    await db.refresh(jp)
    await create_audit_log(
        db, action="job_position.create", resource_type="job_position",
        resource_id=str(jp.id), user_id=str(current_user.id),
        new_values={"name": jp.name, "code": jp.code, "max_headcount": jp.max_headcount},
        success=True,
    )
    await db.commit()

    return await _build_response(db, jp, 0)


@router.put("/{jp_id}", response_model=JobPositionResponse)
async def update_job_position(
    jp_id: str,
    body: JobPositionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_settings')),
):
    try:
        jp_uuid = UUID(jp_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy vị trí việc làm")
    result = await db.execute(select(JobPosition).where(JobPosition.id == jp_uuid))
    jp = result.scalar_one_or_none()
    if not jp:
        raise NotFoundError(detail="Không tìm thấy vị trí việc làm")

    update_data = body.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"] != jp.code:
        existing = await db.execute(select(JobPosition).where(JobPosition.code == update_data["code"]))
        if existing.scalar_one_or_none():
            raise ConflictError(detail="Mã vị trí việc làm đã tồn tại")

    old_values = {k: getattr(jp, k, None) for k in update_data.keys()}
    for key, value in update_data.items():
        setattr(jp, key, value)

    await db.flush()
    await db.refresh(jp)

    emp_count_result = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.job_position_id == jp_uuid, Employee.is_active == True)
    )
    emp_count = emp_count_result.scalar() or 0

    new_values = {k: (str(v) if isinstance(v, UUID) else v) for k, v in update_data.items()}
    await create_audit_log(
        db, action="job_position.update", resource_type="job_position",
        resource_id=str(jp.id), user_id=str(current_user.id),
        old_values=old_values, new_values=new_values, success=True,
    )
    await db.commit()

    return await _build_response(db, jp, emp_count)


@router.delete("/{jp_id}")
async def delete_job_position(
    jp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_settings')),
):
    try:
        jp_uuid = UUID(jp_id)
    except ValueError:
        raise NotFoundError(detail="Không tìm thấy vị trí việc làm")
    result = await db.execute(select(JobPosition).where(JobPosition.id == jp_uuid))
    jp = result.scalar_one_or_none()
    if not jp:
        raise NotFoundError(detail="Không tìm thấy vị trí việc làm")

    emp_count = await db.execute(
        select(func.count(Employee.id))
        .where(Employee.job_position_id == jp_uuid, Employee.is_active == True)
    )
    if emp_count.scalar() > 0:
        raise BadRequestError(detail="Không thể xoá vị trí việc làm đang có nhân sự")

    jp.is_active = False
    await create_audit_log(
        db, action="job_position.delete", resource_type="job_position",
        resource_id=jp_id, user_id=str(current_user.id),
        old_values={"is_active": True}, new_values={"is_active": False}, success=True,
    )
    await db.commit()
    return {"message": "Đã vô hiệu hóa vị trí việc làm"}
