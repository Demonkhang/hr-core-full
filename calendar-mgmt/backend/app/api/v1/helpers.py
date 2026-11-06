from app.schemas.leave_registration import LeaveRegistrationResponse
from app.schemas.overtime_registration import OvertimeRegistrationResponse
from app.schemas.leave_balance import LeaveBalanceResponse
from app.models.leave_registration import LeaveRegistration
from app.models.overtime_registration import OvertimeRegistration
from app.models.leave_balance import LeaveBalance
from app.clients.hr_client import hr_client


def build_leave_registration_response(reg: LeaveRegistration, emp: dict = None, dept_name: str = None) -> LeaveRegistrationResponse:
    return LeaveRegistrationResponse(
        id=str(reg.id),
        employee_id=str(reg.employee_id),
        leave_type=reg.leave_type,
        start_date=reg.start_date,
        end_date=reg.end_date,
        start_session=reg.start_session,
        end_session=reg.end_session,
        total_days=reg.total_days,
        reason=reg.reason,
        status=reg.status,
        approved_by_id=str(reg.approved_by_id) if reg.approved_by_id else None,
        approved_at=reg.approved_at,
        rejection_reason=reg.rejection_reason,
        is_active=reg.is_active,
        employee_name=emp.get("full_name") if emp else None,
        department_name=dept_name,
        created_at=reg.created_at,
        updated_at=reg.updated_at,
    )


def build_overtime_registration_response(reg: OvertimeRegistration, emp: dict = None, dept_name: str = None) -> OvertimeRegistrationResponse:
    return OvertimeRegistrationResponse(
        id=str(reg.id),
        employee_id=str(reg.employee_id),
        date=reg.date,
        start_time=reg.start_time,
        end_time=reg.end_time,
        total_hours=reg.total_hours,
        reason=reg.reason,
        status=reg.status,
        approved_by_id=str(reg.approved_by_id) if reg.approved_by_id else None,
        approved_at=reg.approved_at,
        rejection_reason=reg.rejection_reason,
        is_active=reg.is_active,
        employee_name=emp.get("full_name") if emp else None,
        department_name=dept_name,
        created_at=reg.created_at,
        updated_at=reg.updated_at,
    )


def build_leave_balance_response(
    b: LeaveBalance,
    emp: dict = None,
    dept_name: str = None,
    stats: dict = None,
) -> LeaveBalanceResponse:
    from app.services.leave_service import LeaveService

    stats = stats or {}
    other_leave_days = round(float(stats.get("other_leave_days", 0.0)), 1)
    used_days = round(float(b.used or 0.0), 1)
    hire_date_str = str(emp.get("hire_date")) if emp and emp.get("hire_date") else None
    max_sick = LeaveService.get_max_sick_days_for_year(hire_date_str, b.year)
    return LeaveBalanceResponse(
        id=str(b.id),
        employee_id=str(b.employee_id),
        year=b.year,
        total_allocated=round(float(b.total_allocated or 0.0), 1),
        carried_over=round(float(b.carried_over or 0.0), 1),
        used=used_days,
        remaining=round(float(b.remaining or 0.0), 1),
        is_active=b.is_active,
        employee_name=emp.get("full_name") if emp else None,
        employee_code=emp.get("employee_code") if emp else None,
        department_id=str(emp.get("department_id")) if emp and emp.get("department_id") else None,
        department_name=dept_name or (emp.get("department_name") if emp else None),
        hire_date=hire_date_str,
        pending_days=round(float(stats.get("pending_days", 0.0)), 1),
        other_leave_days=other_leave_days,
        other_pending_days=round(float(stats.get("other_pending_days", 0.0)), 1),
        sick_days=round(float(stats.get("sick_days", 0.0)), 1),
        max_sick_days=max_sick,
        personal_paid_days=round(float(stats.get("personal_paid_days", 0.0)), 1),
        personal_unpaid_days=round(float(stats.get("personal_unpaid_days", 0.0)), 1),
        maternity_days=round(float(stats.get("maternity_days", 0.0)), 1),
        total_taken_days=round(used_days + other_leave_days, 1),
        created_at=b.created_at,
        updated_at=b.updated_at,
    )
