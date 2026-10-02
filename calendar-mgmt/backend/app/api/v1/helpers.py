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


def build_leave_balance_response(b: LeaveBalance, emp: dict = None, dept_name: str = None) -> LeaveBalanceResponse:
    return LeaveBalanceResponse(
        id=str(b.id),
        employee_id=str(b.employee_id),
        year=b.year,
        total_allocated=b.total_allocated,
        carried_over=b.carried_over,
        used=b.used,
        remaining=b.remaining,
        is_active=b.is_active,
        employee_name=emp.get("full_name") if emp else None,
        department_name=dept_name,
        created_at=b.created_at,
        updated_at=b.updated_at,
    )
