from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, RequirePermission
from app.schemas.training import (
    QualificationCreate, QualificationUpdate, QualificationResponse,
)
from app.models.employee import Employee
from app.models.training import Training
from app.models.user import User
from app.core.exceptions import NotFoundError
from app.core.constants import RESPONSE_MESSAGES

router = APIRouter()


async def _get_employee(emp_id: str, db: AsyncSession) -> Employee:
    emp = await db.get(Employee, emp_id)
    if not emp:
        raise NotFoundError(detail=RESPONSE_MESSAGES["EMPLOYEE_NOT_FOUND"])
    return emp


def _build_response(t: Training, employee_name: str = None) -> QualificationResponse:
    return QualificationResponse(
        id=str(t.id),
        employee_id=str(t.employee_id),
        name=t.name,
        issuing_body=t.issuing_body,
        issue_date=t.issue_date,
        expiry_date=t.expiry_date,
        credential_type=t.credential_type,
        classification=t.classification,
        major=t.major,
        certificate_number=t.certificate_number,
        training_form=t.training_form,
        notes=t.notes,
        employee_name=employee_name,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get(
    "/employees/{emp_id}/qualifications",
    response_model=List[QualificationResponse],
)
async def list_qualifications(
    emp_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    emp = await _get_employee(emp_id, db)
    result = await db.execute(
        select(Training)
        .where(Training.employee_id == emp_id)
        .order_by(Training.issue_date.desc())
    )
    records = result.scalars().all()
    return [_build_response(r, emp.full_name) for r in records]


@router.post(
    "/employees/{emp_id}/qualifications",
    response_model=QualificationResponse,
    status_code=201,
)
async def create_qualification(
    emp_id: str,
    body: QualificationCreate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_employees")),
):
    emp = await _get_employee(emp_id, db)
    record = Training(
        employee_id=emp.id,
        name=body.name,
        issuing_body=body.issuing_body,
        issue_date=body.issue_date,
        expiry_date=body.expiry_date,
        credential_type=body.credential_type,
        classification=body.classification,
        major=body.major,
        certificate_number=body.certificate_number,
        training_form=body.training_form,
        notes=body.notes,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _build_response(record, emp.full_name)


@router.put(
    "/employees/{emp_id}/qualifications/{record_id}",
    response_model=QualificationResponse,
)
async def update_qualification(
    emp_id: str,
    record_id: str,
    body: QualificationUpdate,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_employees")),
):
    emp = await _get_employee(emp_id, db)
    result = await db.execute(
        select(Training).where(
            Training.id == record_id,
            Training.employee_id == emp_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError(detail="Không tìm thấy bản ghi trình độ chuyên môn")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    await db.commit()
    await db.refresh(record)
    return _build_response(record, emp.full_name)


@router.delete(
    "/employees/{emp_id}/qualifications/{record_id}",
    status_code=204,
)
async def delete_qualification(
    emp_id: str,
    record_id: str,
    db: AsyncSession = Depends(get_db),
    perms: dict = Depends(RequirePermission("can_manage_employees")),
):
    result = await db.execute(
        select(Training).where(
            Training.id == record_id,
            Training.employee_id == emp_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError(detail="Không tìm thấy bản ghi trình độ chuyên môn")

    await db.delete(record)
    await db.commit()
