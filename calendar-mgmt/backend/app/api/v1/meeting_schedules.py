import logging
from typing import Optional, List
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.api.deps import get_current_user, get_current_permissions, RequirePermission
from app.schemas.meeting_schedule import (
    MeetingScheduleCreate, MeetingScheduleUpdate, MeetingScheduleResponse,
)
from app.models.meeting_schedule import MeetingSchedule, MeetingStatus
from app.models.meeting_participant import MeetingParticipant
from app.core.exceptions import NotFoundError, ForbiddenError, BadRequestError
from app.clients.hr_client import hr_client

logger = logging.getLogger(__name__)

class BulkApproveRequest(BaseModel):
    meeting_ids: list[str]


class BulkRejectRequest(BaseModel):
    meeting_ids: list[str]
    reason: str


router = APIRouter()


async def _get_meeting(meeting_id: str, db: AsyncSession) -> MeetingSchedule:
    result = await db.execute(
        select(MeetingSchedule).where(MeetingSchedule.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise NotFoundError(detail="Không tìm thấy lịch họp")
    return meeting


@router.get("", response_model=list[dict])
async def list_meeting_schedules(
    employee_id: Optional[str] = Query(None),
    department_id: Optional[List[str]] = Query(None),
    status: Optional[str] = Query(None),
    meeting_type: Optional[str] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if date_from and date_to and date_from > date_to:
        raise BadRequestError(detail="date_from phải trước hoặc bằng date_to")
    query = select(MeetingSchedule)
    if active_only:
        query = query.where(MeetingSchedule.is_active == True)
    if status:
        query = query.where(MeetingSchedule.status == status)
    if meeting_type:
        query = query.where(MeetingSchedule.meeting_type == meeting_type)
    if date_from:
        query = query.where(MeetingSchedule.date >= date_from)
    if date_to:
        query = query.where(MeetingSchedule.date <= date_to)
    if department_id:
        query = query.where(MeetingSchedule.department_id.in_(department_id))

    query = query.order_by(MeetingSchedule.date.desc(), MeetingSchedule.start_time.desc())
    result = await db.execute(query)
    meetings = result.scalars().unique().all()

    results = []
    for m in meetings:
        parts_result = await db.execute(
            select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id)
        )
        participants = parts_result.scalars().all()
        emp_ids = [str(p.employee_id) for p in participants]
        emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

        dept_name = None
        if m.department_id:
            dept = await hr_client.get_department(str(m.department_id))
            dept_name = dept.get("name") if dept else None

        created_by_name = None
        if m.created_by_id:
            user_data = await hr_client.get_employee(str(m.created_by_id))
            created_by_name = user_data.get("full_name") if user_data else None

        parts_list = []
        for p in participants:
            emp = emp_map.get(str(p.employee_id))
            parts_list.append({
                "id": str(p.id),
                "employee_id": str(p.employee_id),
                "employee_name": emp.get("full_name") if emp else None,
                "department_name": None,
                "response_status": p.response_status,
                "created_at": p.created_at,
            })

        results.append({
            "id": str(m.id),
            "title": m.title,
            "meeting_type": m.meeting_type,
            "date": m.date,
            "start_time": m.start_time,
            "location": m.location,
            "description": m.description,
            "department_id": str(m.department_id) if m.department_id else None,
            "department_name": dept_name,
            "created_by_id": str(m.created_by_id) if m.created_by_id else None,
            "created_by_name": created_by_name,
            "status": m.status,
            "approved_by_id": str(m.approved_by_id) if m.approved_by_id else None,
            "approved_by_name": None,
            "approved_at": m.approved_at,
            "rejection_reason": m.rejection_reason,
            "is_active": m.is_active,
            "participants": parts_list,
            "participant_count": len(parts_list),
            "created_at": m.created_at,
            "updated_at": m.updated_at,
        })

    return results


@router.get("/{meeting_id}")
async def get_meeting_schedule(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    meeting = await _get_meeting(meeting_id, db)

    parts_result = await db.execute(
        select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id)
    )
    participants = parts_result.scalars().all()
    emp_ids = [str(p.employee_id) for p in participants]
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    dept_name = None
    if meeting.department_id:
        dept = await hr_client.get_department(str(meeting.department_id))
        dept_name = dept.get("name") if dept else None

    created_by_name = None
    if meeting.created_by_id:
        user_data = await hr_client.get_employee(str(meeting.created_by_id))
        created_by_name = user_data.get("full_name") if user_data else None

    parts_list = []
    for p in participants:
        emp = emp_map.get(str(p.employee_id))
        parts_list.append({
            "id": str(p.id),
            "employee_id": str(p.employee_id),
            "employee_name": emp.get("full_name") if emp else None,
            "department_name": None,
            "response_status": p.response_status,
            "created_at": p.created_at,
        })

    return {
        "id": str(meeting.id),
        "title": meeting.title,
        "meeting_type": meeting.meeting_type,
        "date": meeting.date,
        "start_time": meeting.start_time,
        "location": meeting.location,
        "description": meeting.description,
        "department_id": str(meeting.department_id) if meeting.department_id else None,
        "department_name": dept_name,
        "created_by_id": str(meeting.created_by_id) if meeting.created_by_id else None,
        "created_by_name": created_by_name,
        "status": meeting.status,
        "approved_by_id": str(meeting.approved_by_id) if meeting.approved_by_id else None,
        "approved_by_name": None,
        "approved_at": meeting.approved_at,
        "rejection_reason": meeting.rejection_reason,
        "is_active": meeting.is_active,
        "participants": parts_list,
        "participant_count": len(parts_list),
        "created_at": meeting.created_at,
        "updated_at": meeting.updated_at,
    }


@router.post("", status_code=201)
async def create_meeting_schedule(
    body: MeetingScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_meetings')),
):
    meeting = MeetingSchedule(
        title=body.title,
        meeting_type=body.meeting_type,
        date=body.date,
        start_time=body.start_time,
        location=body.location,
        description=body.description,
        department_id=body.department_id,
        created_by_id=current_user.get("id"),
        status=MeetingStatus.PENDING,
    )
    db.add(meeting)
    await db.flush()

    if body.participant_ids:
        for emp_id in body.participant_ids:
            participant = MeetingParticipant(
                meeting_id=meeting.id,
                employee_id=emp_id,
            )
            db.add(participant)
    await db.commit()

    parts_result = await db.execute(
        select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id)
    )
    participants = parts_result.scalars().all()
    emp_ids = [str(p.employee_id) for p in participants]
    emp_map = await hr_client.get_employees_batch(emp_ids) if emp_ids else {}

    dept_name = None
    if meeting.department_id:
        dept = await hr_client.get_department(str(meeting.department_id))
        dept_name = dept.get("name") if dept else None

    parts_list = []
    for p in participants:
        emp = emp_map.get(str(p.employee_id))
        parts_list.append({
            "id": str(p.id),
            "employee_id": str(p.employee_id),
            "employee_name": emp.get("full_name") if emp else None,
            "department_name": None,
            "response_status": p.response_status,
            "created_at": p.created_at,
        })

    return {
        "id": str(meeting.id),
        "title": meeting.title,
        "meeting_type": meeting.meeting_type,
        "date": meeting.date,
        "start_time": meeting.start_time,
        "location": meeting.location,
        "description": meeting.description,
        "department_id": str(meeting.department_id) if meeting.department_id else None,
        "department_name": dept_name,
        "created_by_id": str(meeting.created_by_id) if meeting.created_by_id else None,
        "created_by_name": None,
        "status": meeting.status,
        "approved_by_id": None,
        "approved_by_name": None,
        "approved_at": None,
        "rejection_reason": None,
        "is_active": meeting.is_active,
        "participants": parts_list,
        "participant_count": len(parts_list),
        "created_at": meeting.created_at,
        "updated_at": meeting.updated_at,
    }


@router.put("/{meeting_id}")
async def update_meeting_schedule(
    meeting_id: str,
    body: MeetingScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_meetings')),
):
    meeting = await _get_meeting(meeting_id, db)
    if meeting.status != MeetingStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể sửa lịch họp khi đang ở trạng thái chờ duyệt")

    update_data = body.model_dump(exclude_unset=True, exclude={"participant_ids"})
    logger.info(f"update_meeting_schedule update_data: {update_data}")
    for key, value in update_data.items():
        setattr(meeting, key, value)

    if body.participant_ids is not None:
        existing = await db.execute(
            select(MeetingParticipant).where(MeetingParticipant.meeting_id == meeting.id)
        )
        for p in existing.scalars().all():
            await db.delete(p)
        await db.flush()
        for emp_id in body.participant_ids:
            participant = MeetingParticipant(
                meeting_id=meeting.id,
                employee_id=emp_id,
            )
            db.add(participant)

    await db.commit()
    return {"message": "Đã cập nhật lịch họp"}


@router.delete("/{meeting_id}")
async def delete_meeting_schedule(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_manage_meetings')),
):
    meeting = await _get_meeting(meeting_id, db)
    meeting.status = MeetingStatus.CANCELLED
    meeting.is_active = False
    await db.commit()
    return {"message": "Đã huỷ lịch họp"}


@router.post("/{meeting_id}/approve")
async def approve_meeting_schedule(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_meetings')),
):
    meeting = await _get_meeting(meeting_id, db)
    if meeting.status != MeetingStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể duyệt lịch họp đang chờ duyệt")

    meeting.status = MeetingStatus.APPROVED
    meeting.approved_by_id = current_user.get("id")
    meeting.approved_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Đã duyệt lịch họp"}


@router.post("/{meeting_id}/reject")
async def reject_meeting_schedule(
    meeting_id: str,
    reason: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_meetings')),
):
    meeting = await _get_meeting(meeting_id, db)
    if meeting.status != MeetingStatus.PENDING:
        raise BadRequestError(detail="Chỉ có thể từ chối lịch họp đang chờ duyệt")

    meeting.status = MeetingStatus.REJECTED
    meeting.rejection_reason = reason
    meeting.approved_by_id = current_user.get("id")
    meeting.approved_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Đã từ chối lịch họp"}


@router.post("/bulk-approve")
async def bulk_approve_meetings(
    body: BulkApproveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_meetings')),
):
    errors = []
    approved = []
    for mid in body.meeting_ids:
        meeting = await db.get(MeetingSchedule, mid)
        if not meeting:
            errors.append({"id": mid, "error": "Không tìm thấy lịch họp"})
            continue
        if meeting.status != MeetingStatus.PENDING:
            errors.append({"id": mid, "error": "Lịch họp không ở trạng thái chờ duyệt"})
            continue
        meeting.status = MeetingStatus.APPROVED
        meeting.approved_by_id = current_user.get("id")
        meeting.approved_at = datetime.now(timezone.utc)
        approved.append(mid)
    await db.commit()
    return {
        "success_count": len(approved),
        "errors": errors,
        "total": len(body.meeting_ids),
    }


@router.post("/bulk-reject")
async def bulk_reject_meetings(
    body: BulkRejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    perms: dict = Depends(RequirePermission('can_approve_meetings')),
):
    errors = []
    rejected = []
    for mid in body.meeting_ids:
        meeting = await db.get(MeetingSchedule, mid)
        if not meeting:
            errors.append({"id": mid, "error": "Không tìm thấy lịch họp"})
            continue
        if meeting.status != MeetingStatus.PENDING:
            errors.append({"id": mid, "error": "Lịch họp không ở trạng thái chờ duyệt"})
            continue
        meeting.status = MeetingStatus.REJECTED
        meeting.rejection_reason = body.reason
        meeting.approved_by_id = current_user.get("id")
        meeting.approved_at = datetime.now(timezone.utc)
        rejected.append(mid)
    await db.commit()
    return {
        "success_count": len(rejected),
        "errors": errors,
        "total": len(body.meeting_ids),
    }
