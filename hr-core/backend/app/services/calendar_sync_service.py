import logging
import httpx
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)


async def notify_calendar_clear_cache(key: Optional[str] = None):
    try:
        url = f"{settings.CALENDAR_MGMT_BASE_URL.rstrip('/')}/api/v1/hr/internal/clear-cache"
        params = {"key": key} if key else {}
        async with httpx.AsyncClient(timeout=3) as client:
            await client.post(url, params=params)
            logger.info(f"Notified calendar-mgmt to clear cache: key={key}")
    except Exception as e:
        logger.warning(f"Failed to notify calendar-mgmt clear cache: {e}")


async def notify_calendar_offboard_employee(employee_id: str):
    try:
        url = f"{settings.CALENDAR_MGMT_BASE_URL.rstrip('/')}/api/v1/hr/internal/offboard-employee"
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(url, json={"employee_id": employee_id})
            logger.info(f"Notified calendar-mgmt employee offboard: {employee_id}, status={resp.status_code}")
    except Exception as e:
        logger.warning(f"Failed to notify calendar-mgmt employee offboard: {e}")
