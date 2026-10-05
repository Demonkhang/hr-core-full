import logging
import time
from typing import Optional
from uuid import UUID

import httpx
from app.config import settings

logger = logging.getLogger(__name__)


class HRClient:
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)
        self._cache: dict = {}
        self._cache_ttl: int = 300  # 5 minutes

    def _cache_get(self, key: str) -> Optional[dict]:
        entry = self._cache.get(key)
        if entry and time.time() - entry["ts"] < self._cache_ttl:
            return entry["data"]
        if entry:
            del self._cache[key]
        return None

    def _cache_set(self, key: str, data: dict) -> None:
        self._cache[key] = {"data": data, "ts": time.time()}

    async def get_employee(self, employee_id: str, token: str = "") -> Optional[dict]:
        cache_key = f"emp:{employee_id}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/employees/{employee_id}",
                headers=headers,
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._cache_set(cache_key, data)
                return data
            elif resp.status_code == 404:
                return None
            logger.warning(f"HR employee fetch failed: {resp.status_code}")
            return None
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return None

    async def get_employees(self, active_only: bool = True, token: str = "") -> list[dict]:
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            params = {"active_only": "true" if active_only else "false"}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/employees",
                headers=headers,
                params=params,
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"HR employees list failed: {resp.status_code}")
            return []
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return []

    async def get_employees_batch(self, ids: list[str], token: str = "") -> dict[str, dict]:
        result = {}
        uncached = []
        for eid in ids:
            cached = self._cache_get(f"emp:{eid}")
            if cached:
                result[eid] = cached
            else:
                uncached.append(eid)
        if uncached:
            try:
                headers = {"Authorization": f"Bearer {token}"} if token else {}
                resp = await self._client.post(
                    f"{self.base_url}/api/v1/employees/batch",
                    json={"ids": uncached},
                    headers=headers,
                    timeout=10,
                )
                if resp.status_code == 200:
                    for emp in resp.json():
                        eid = str(emp["id"])
                        self._cache_set(f"emp:{eid}", emp)
                        result[eid] = emp
            except httpx.RequestError as e:
                logger.error(f"HR batch fetch failed: {e}")
                for eid in uncached:
                    result.setdefault(eid, None)
        return result

    async def get_department(self, department_id: str, token: str = "") -> Optional[dict]:
        cache_key = f"dept:{department_id}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/departments/{department_id}",
                headers=headers,
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._cache_set(cache_key, data)
                return data
            return None
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return None

    async def get_workplace(self, workplace_id: str, token: str = "") -> Optional[dict]:
        cache_key = f"wp:{workplace_id}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/workplaces/{workplace_id}",
                headers=headers,
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._cache_set(cache_key, data)
                return data
            return None
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return None

    async def get_workplaces_batch(self, ids: list[str], token: str = "") -> dict[str, dict]:
        result = {}
        uncached = []
        for wp_id in ids:
            cached = self._cache_get(f"wp:{wp_id}")
            if cached:
                result[wp_id] = cached
            else:
                uncached.append(wp_id)
        if uncached:
            import asyncio
            wps = await asyncio.gather(*[self.get_workplace(wid, token=token) for wid in uncached])
            for wid, wp in zip(uncached, wps):
                if wp:
                    result[wid] = wp
        return result

    async def list_positions(self, token: str = "") -> list[dict]:
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/positions",
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"HR positions list failed: {resp.status_code}")
            return []
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return []

    async def update_position(self, pos_id: str, data: dict, token: str = "") -> Optional[dict]:
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.put(
                f"{self.base_url}/api/v1/positions/{pos_id}",
                json=data,
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"HR position update failed: {resp.status_code}")
            return None
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return None

    async def get_current_user(self, token: str) -> Optional[dict]:
        cache_key = f"token:{token}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        try:
            resp = await self._client.get(
                f"{self.base_url}/api/v1/auth/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._cache_set(cache_key, data)
                return data
            logger.warning(f"HR auth/me failed: {resp.status_code}")
            return None
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return None

    async def get_active_salary_config(self, token: str = "") -> Optional[dict]:
        cache_key = "salary_config:active"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/salary-config/public-sector-active",
                headers=headers,
                timeout=5,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._cache_set(cache_key, data)
                return data
            logger.warning(f"HR active salary config fetch failed: {resp.status_code}")
            return None
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return None

    async def list_shift_rate_configs(self, token: str = "") -> list[dict]:
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            resp = await self._client.get(
                f"{self.base_url}/api/v1/shift-rate-configs",
                headers=headers,
                timeout=5,
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"HR shift rate configs fetch failed: {resp.status_code}")
            return []
        except httpx.RequestError as e:
            logger.error(f"HR Core unavailable: {e}")
            return []

    async def close(self):
        await self._client.aclose()


hr_client = HRClient(base_url=settings.HR_CORE_BASE_URL)

