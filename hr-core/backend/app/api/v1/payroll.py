import logging
from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/attendance-summary")
async def receive_attendance_summary(
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    month = body.get("month")
    summaries = body.get("summaries", [])
    logger.info(f"Received finalized attendance summary for month={month}, count={len(summaries)}")

    return {
        "status": "ok",
        "message": f"HR Core đã nhận bảng công tháng {month} với {len(summaries)} nhân viên",
        "month": month,
        "record_count": len(summaries)
    }
