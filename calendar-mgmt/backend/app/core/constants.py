from enum import Enum


class ScheduleStatus(str, Enum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class TokenType(str, Enum):
    ACCESS = "access"
    REFRESH = "refresh"


class ChangeType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    ADJUST = "adjust"
    SUBMIT = "submit"
    APPROVE = "approve"
    REJECT = "reject"
    IMPORT = "import"


SCOPE_ORGANIZATION = "organization"
SCOPE_DEPARTMENT = "department"
SCOPE_SELF = "self"


RESPONSE_MESSAGES = {
    "LOGOUT": "Đã đăng xuất",
    "PASSWORD_CHANGED": "Đã đổi mật khẩu",
    "SCHEDULE_CANCELLED": "Đã hủy lịch làm việc",
    "EMPLOYEE_NOT_FOUND": "Không tìm thấy nhân viên",
    "DEPARTMENT_NOT_FOUND": "Không tìm thấy phòng ban",
    "SCHEDULE_NOT_FOUND": "Không tìm thấy lịch làm việc",
    "INVALID_CREDENTIALS": "Tên đăng nhập hoặc mật khẩu không đúng",
    "ACCOUNT_DISABLED": "Tài khoản đã bị vô hiệu hóa",
    "UNAUTHENTICATED": "Chưa xác thực",
    "INVALID_TOKEN": "Token không hợp lệ hoặc đã hết hạn",
    "USER_NOT_FOUND": "Người dùng không tồn tại hoặc đã bị vô hiệu",
    "FORBIDDEN": "Không có quyền",
    "INVALID_REFRESH": "Refresh token không hợp lệ",
    "WRONG_PASSWORD": "Mật khẩu hiện tại không đúng",
    "DUPLICATE_CREDENTIALS": "Tên đăng nhập hoặc email đã tồn tại",
    "INVALID_MONTH_FORMAT": "Định dạng tháng không hợp lệ. Sử dụng YYYY-MM",
    "ONLY_EXCEL_SUPPORTED": "Chỉ hỗ trợ file Excel (.xlsx, .xls)",
    "EMPTY_FILE": "File rỗng",
}
