from datetime import date, timedelta
from calendar import monthrange
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.leave_balance import LeaveBalance
from app.models.leave_registration import LeaveRegistration, LeaveType, LeaveRegistrationStatus
from app.core.exceptions import BadRequestError
from app.clients.hr_client import hr_client


def _completed_years(hire_date: date, as_of: date) -> int:
    years = as_of.year - hire_date.year
    if (as_of.month, as_of.day) < (hire_date.month, hire_date.day):
        years -= 1
    return max(0, years)


def _days_in_year(year: int) -> int:
    return 366 if monthrange(year, 2)[1] == 29 else 365


async def _base_allocated_for(employee_id: str, year: int) -> float:
    emp = await hr_client.get_employee(employee_id)
    if not emp or not emp.get("hire_date"):
        return 12.0

    hire_date_str = emp["hire_date"]
    try:
        hire_date = date.fromisoformat(hire_date_str)
    except (ValueError, TypeError):
        return 12.0

    if hire_date > date(year, 12, 31):
        return 0.0

    base = 12.0 + _completed_years(hire_date, date(year, 1, 1)) // 5

    if hire_date.year == year:
        remaining = (date(year, 12, 31) - hire_date).days + 1
        total = _days_in_year(year)
        base = round(base * remaining / total, 1)
        base = max(base, 0.5)

    return base


class LeaveService:
    @staticmethod
    def calculate_total_days(
        start_date: date,
        end_date: date,
        start_session: str = "full",
        end_session: str = "full",
        exclude_weekends: bool = True
    ) -> float:
        if start_date > end_date:
            raise BadRequestError("Ngày bắt đầu không được lớn hơn ngày kết thúc")

        if start_date == end_date:
            if exclude_weekends and start_date.weekday() in (5, 6):
                return 0.0
            return 1.0 if start_session == "full" else 0.5

        total_days = 0.0
        curr = start_date
        while curr <= end_date:
            if exclude_weekends and curr.weekday() in (5, 6):
                curr += timedelta(days=1)
                continue

            day_fraction = 1.0
            if curr == start_date:
                day_fraction = 1.0 if start_session == "full" else 0.5
            elif curr == end_date:
                day_fraction = 1.0 if end_session == "full" else 0.5

            total_days += day_fraction
            curr += timedelta(days=1)

        return total_days

    @staticmethod
    def calculate_days_by_year(
        start_date: date,
        end_date: date,
        start_session: str = "full",
        end_session: str = "full",
        exclude_weekends: bool = True
    ) -> dict[int, float]:
        if start_date > end_date:
            raise BadRequestError("Ngày bắt đầu không được lớn hơn ngày kết thúc")

        days_by_year = {}

        if start_date == end_date:
            yr = start_date.year
            if exclude_weekends and start_date.weekday() in (5, 6):
                days_by_year[yr] = 0.0
            else:
                days_by_year[yr] = 1.0 if start_session == "full" else 0.5
            return days_by_year

        curr = start_date
        while curr <= end_date:
            yr = curr.year
            if yr not in days_by_year:
                days_by_year[yr] = 0.0

            if exclude_weekends and curr.weekday() in (5, 6):
                curr += timedelta(days=1)
                continue

            day_fraction = 1.0
            if curr == start_date:
                day_fraction = 1.0 if start_session == "full" else 0.5
            elif curr == end_date:
                day_fraction = 1.0 if end_session == "full" else 0.5

            days_by_year[yr] += day_fraction
            curr += timedelta(days=1)

        return days_by_year

    @classmethod
    async def get_or_create_balance(
        cls, db: AsyncSession, employee_id: str, year: int
    ) -> LeaveBalance:
        result = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.employee_id == employee_id,
                LeaveBalance.year == year,
                LeaveBalance.is_active == True
            )
        )
        balance = result.scalar_one_or_none()

        total_allocated = await _base_allocated_for(employee_id, year)

        if not balance:
            balance = LeaveBalance(
                employee_id=employee_id,
                year=year,
                total_allocated=total_allocated,
                carried_over=0.0,
                used=0.0,
                remaining=total_allocated,
            )
            db.add(balance)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                result = await db.execute(
                    select(LeaveBalance).where(
                        LeaveBalance.employee_id == employee_id,
                        LeaveBalance.year == year,
                        LeaveBalance.is_active == True
                    )
                )
                balance = result.scalar_one_or_none()
                if not balance:
                    raise
        else:
            if balance.total_allocated != total_allocated:
                balance.total_allocated = total_allocated
                balance.remaining = total_allocated + balance.carried_over - balance.used
                await db.flush()

        return balance

    @classmethod
    async def recalculate_leave_balance(
        cls, db: AsyncSession, employee_id: str, year: int
    ) -> LeaveBalance:
        result = await db.execute(
            select(LeaveRegistration).where(
                LeaveRegistration.employee_id == employee_id,
                LeaveRegistration.leave_type == LeaveType.ANNUAL,
                LeaveRegistration.status == LeaveRegistrationStatus.APPROVED,
                LeaveRegistration.is_active == True
            )
        )
        approved_registrations = result.scalars().all()

        total_used = 0.0
        for reg in approved_registrations:
            days_by_year = cls.calculate_days_by_year(
                reg.start_date, reg.end_date, reg.start_session, reg.end_session
            )
            total_used += days_by_year.get(year, 0.0)

        balance = await cls.get_or_create_balance(db, employee_id, year)
        balance.used = total_used
        balance.remaining = balance.total_allocated + balance.carried_over - total_used

        await db.flush()
        return balance

    @classmethod
    async def init_leave_balances(cls, db: AsyncSession, year: int) -> int:
        count = 0
        existing_result = await db.execute(
            select(LeaveBalance.employee_id).where(
                LeaveBalance.year == year,
                LeaveBalance.is_active == True,
            )
        )
        existing_ids = {str(row[0]) for row in existing_result.all()}

        employees = await hr_client.get_employees(active_only=True)
        for emp in employees:
            emp_id = str(emp["id"])
            if emp_id not in existing_ids:
                balance = await cls.get_or_create_balance(db, emp_id, year)
                if balance:
                    count += 1

        return count
