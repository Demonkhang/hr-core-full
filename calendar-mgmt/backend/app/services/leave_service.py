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


# Danh mục ngày nghỉ Lễ, Tết theo Điều 112 Bộ luật Lao động 2019
FIXED_HOLIDAYS_MM_DD = {
    (1, 1),   # Tết Dương lịch
    (4, 30),  # Ngày Chiến thắng
    (5, 1),   # Ngày Quốc tế lao động
    (9, 2),   # Quốc khánh
    (9, 3),   # Nghỉ liền kề Quốc khánh
}

LUNAR_AND_SPECIAL_HOLIDAYS = {
    # 2025: Tết Ất Tỵ & Giỗ Tổ Hùng Vương (10/3 ÂL = 07/04/2025)
    date(2025, 1, 27), date(2025, 1, 28), date(2025, 1, 29), date(2025, 1, 30), date(2025, 1, 31),
    date(2025, 4, 7),
    # 2026: Tết Bính Ngọ (16/02 - 20/02/2026) & Giỗ Tổ Hùng Vương (10/3 ÂL = 26/04/2026, nghỉ bù 27/04)
    date(2026, 2, 16), date(2026, 2, 17), date(2026, 2, 18), date(2026, 2, 19), date(2026, 2, 20),
    date(2026, 4, 26), date(2026, 4, 27),
    # 2027: Tết Đinh Mùi (05/02 - 11/02/2027) & Giỗ Tổ Hùng Vương (10/3 ÂL = 16/04/2027)
    date(2027, 2, 5), date(2027, 2, 8), date(2027, 2, 9), date(2027, 2, 10), date(2027, 2, 11),
    date(2027, 4, 16),
}


def is_public_holiday(d: date) -> bool:
    return (d.month, d.day) in FIXED_HOLIDAYS_MM_DD or d in LUNAR_AND_SPECIAL_HOLIDAYS


class LeaveService:
    @staticmethod
    def is_holiday(d: date) -> bool:
        return is_public_holiday(d)

    @staticmethod
    def get_max_sick_days_for_year(hire_date_str: str | None, year: int) -> float:
        """Theo Điều 26 Luật BHXH: <15 năm: 30 ngày; 15 đến <30 năm: 40 ngày; >=30 năm: 60 ngày."""
        if not hire_date_str:
            return 30.0
        try:
            hire_date = date.fromisoformat(str(hire_date_str))
        except (ValueError, TypeError):
            return 30.0
        years = _completed_years(hire_date, date(year, 12, 31))
        if years >= 30:
            return 60.0
        if years >= 15:
            return 40.0
        return 30.0

    @staticmethod
    def calculate_total_days(
        start_date: date,
        end_date: date,
        start_session: str = "full",
        end_session: str = "full",
        exclude_weekends: bool = True,
        exclude_holidays: bool = True,
    ) -> float:
        if start_date > end_date:
            raise BadRequestError("Ngày bắt đầu không được lớn hơn ngày kết thúc")

        if start_date == end_date:
            if exclude_weekends and start_date.weekday() in (5, 6):
                return 0.0
            if exclude_holidays and is_public_holiday(start_date):
                return 0.0
            return 1.0 if start_session == "full" else 0.5

        total_days = 0.0
        curr = start_date
        while curr <= end_date:
            if (exclude_weekends and curr.weekday() in (5, 6)) or (exclude_holidays and is_public_holiday(curr)):
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
        exclude_weekends: bool = True,
        exclude_holidays: bool = True,
    ) -> dict[int, float]:
        if start_date > end_date:
            raise BadRequestError("Ngày bắt đầu không được lớn hơn ngày kết thúc")

        days_by_year = {}

        if start_date == end_date:
            yr = start_date.year
            if (exclude_weekends and start_date.weekday() in (5, 6)) or (exclude_holidays and is_public_holiday(start_date)):
                days_by_year[yr] = 0.0
            else:
                days_by_year[yr] = 1.0 if start_session == "full" else 0.5
            return days_by_year

        curr = start_date
        while curr <= end_date:
            yr = curr.year
            if yr not in days_by_year:
                days_by_year[yr] = 0.0

            if (exclude_weekends and curr.weekday() in (5, 6)) or (exclude_holidays and is_public_holiday(curr)):
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

    @staticmethod
    async def check_month_finalized(db: AsyncSession, target_date: date) -> None:
        from app.models.monthly_summary import MonthlySummary
        month_start = date(target_date.year, target_date.month, 1)
        res = await db.execute(
            select(MonthlySummary).where(
                MonthlySummary.month == month_start,
                MonthlySummary.is_finalized == True,
            ).limit(1)
        )
        if res.scalars().first():
            raise BadRequestError(
                detail=f"Bảng công tháng {target_date.strftime('%m/%Y')} đã được chốt sổ. Không thể thêm, sửa, xoá hoặc duyệt dữ liệu trong tháng đã chốt."
            )

    @classmethod
    async def check_leave_overlap(
        cls,
        db: AsyncSession,
        employee_id: str,
        start_date: date,
        end_date: date,
        start_session: str = "full",
        end_session: str = "full",
        exclude_reg_id: str | None = None,
    ) -> None:
        query = select(LeaveRegistration).where(
            LeaveRegistration.employee_id == employee_id,
            LeaveRegistration.is_active == True,
            LeaveRegistration.status.in_([
                LeaveRegistrationStatus.PENDING,
                LeaveRegistrationStatus.APPROVED,
            ]),
            LeaveRegistration.start_date <= end_date,
            LeaveRegistration.end_date >= start_date,
        )
        if exclude_reg_id:
            query = query.where(LeaveRegistration.id != exclude_reg_id)

        result = await db.execute(query)
        existing_regs = result.scalars().all()

        def _sessions_for_day(d: date, s_date: date, e_date: date, s_sess: str, e_sess: str) -> set[str]:
            if s_date == e_date:
                return {"morning", "afternoon"} if s_sess == "full" else {s_sess}
            if d == s_date:
                return {"morning", "afternoon"} if s_sess == "full" else {s_sess}
            if d == e_date:
                return {"morning", "afternoon"} if e_sess == "full" else {e_sess}
            return {"morning", "afternoon"}

        for reg in existing_regs:
            overlap_start = max(start_date, reg.start_date)
            overlap_end = min(end_date, reg.end_date)
            curr = overlap_start
            while curr <= overlap_end:
                if curr.weekday() not in (5, 6) and not is_public_holiday(curr):
                    new_s = _sessions_for_day(curr, start_date, end_date, start_session, end_session)
                    old_s = _sessions_for_day(curr, reg.start_date, reg.end_date, reg.start_session, reg.end_session)
                    if new_s & old_s:
                        status_label = "đã duyệt" if reg.status == LeaveRegistrationStatus.APPROVED else "đang chờ duyệt"
                        raise BadRequestError(
                            detail=f"Trùng ngày nghỉ phép: Nhân viên đã có đơn xin nghỉ ({status_label}) trùng vào ngày {curr.strftime('%d/%m/%Y')}."
                        )
                curr += timedelta(days=1)

    @classmethod
    async def carry_over_leave_balances(
        cls,
        db: AsyncSession,
        target_year: int,
        max_carry_over: float = 5.0,
        token: str = "",
    ) -> int:
        prev_year = target_year - 1
        await cls.init_leave_balances(db, target_year, token=token)

        prev_res = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.year == prev_year,
                LeaveBalance.is_active == True,
            )
        )
        prev_map = {str(b.employee_id): b for b in prev_res.scalars().all()}

        curr_res = await db.execute(
            select(LeaveBalance).where(
                LeaveBalance.year == target_year,
                LeaveBalance.is_active == True,
            )
        )
        curr_balances = curr_res.scalars().all()
        updated_count = 0
        for b in curr_balances:
            prev_b = prev_map.get(str(b.employee_id))
            if prev_b and prev_b.remaining > 0:
                carry = min(round(float(prev_b.remaining), 1), max_carry_over)
                if b.carried_over != carry:
                    b.carried_over = carry
                    b.remaining = round(float(b.total_allocated or 0.0) + carry - float(b.used or 0.0), 1)
                    updated_count += 1

        await db.flush()
        return updated_count

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
    async def init_leave_balances(cls, db: AsyncSession, year: int, token: str = "") -> int:
        count = 0
        existing_result = await db.execute(
            select(LeaveBalance.employee_id).where(
                LeaveBalance.year == year,
                LeaveBalance.is_active == True,
            )
        )
        existing_ids = {str(row[0]) for row in existing_result.all()}

        employees = await hr_client.get_employees(active_only=True, token=token)
        for emp in employees:
            emp_id = str(emp["id"])
            if emp_id not in existing_ids:
                balance = await cls.get_or_create_balance(db, emp_id, year)
                if balance:
                    count += 1

        return count

    @classmethod
    async def get_year_leave_stats_map(
        cls,
        db: AsyncSession,
        year: int,
        employee_ids: list[str] | None = None,
    ) -> dict[str, dict[str, float]]:
        start_of_year = date(year, 1, 1)
        end_of_year = date(year, 12, 31)
        query = select(LeaveRegistration).where(
            LeaveRegistration.is_active == True,
            LeaveRegistration.start_date <= end_of_year,
            LeaveRegistration.end_date >= start_of_year,
            LeaveRegistration.status.in_([
                LeaveRegistrationStatus.APPROVED,
                LeaveRegistrationStatus.PENDING,
            ]),
        )
        if employee_ids:
            query = query.where(LeaveRegistration.employee_id.in_(employee_ids))

        result = await db.execute(query)
        registrations = result.scalars().all()

        stats_map: dict[str, dict[str, float]] = {}
        for reg in registrations:
            emp_id = str(reg.employee_id)
            if emp_id not in stats_map:
                stats_map[emp_id] = {
                    "annual_approved_days": 0.0,
                    "pending_days": 0.0,
                    "other_leave_days": 0.0,
                    "other_pending_days": 0.0,
                    "sick_days": 0.0,
                    "personal_paid_days": 0.0,
                    "personal_unpaid_days": 0.0,
                    "maternity_days": 0.0,
                }
            days_in_year = cls.calculate_days_by_year(
                reg.start_date, reg.end_date, reg.start_session, reg.end_session
            ).get(year, 0.0)
            if days_in_year <= 0:
                continue

            if reg.status == LeaveRegistrationStatus.APPROVED:
                if reg.leave_type == LeaveType.ANNUAL:
                    stats_map[emp_id]["annual_approved_days"] += days_in_year
                else:
                    stats_map[emp_id]["other_leave_days"] += days_in_year
                    if reg.leave_type == LeaveType.SICK:
                        stats_map[emp_id]["sick_days"] += days_in_year
                    elif reg.leave_type == LeaveType.PERSONAL_PAID:
                        stats_map[emp_id]["personal_paid_days"] += days_in_year
                    elif reg.leave_type == LeaveType.PERSONAL_UNPAID:
                        stats_map[emp_id]["personal_unpaid_days"] += days_in_year
                    elif reg.leave_type == LeaveType.MATERNITY:
                        stats_map[emp_id]["maternity_days"] += days_in_year
            elif reg.status == LeaveRegistrationStatus.PENDING:
                if reg.leave_type == LeaveType.ANNUAL:
                    stats_map[emp_id]["pending_days"] += days_in_year
                else:
                    stats_map[emp_id]["other_pending_days"] += days_in_year

        return stats_map
