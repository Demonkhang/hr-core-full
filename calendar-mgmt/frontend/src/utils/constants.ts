export { API_ENDPOINTS, HR_API_PREFIX } from './apiEndpoints';
export { ROUTES, STORAGE_KEYS } from './routes';
export { SCOPE, SCOPE_LABELS, SCOPE_COLORS, SCOPE_OPTIONS, PERMISSIONS, PERMISSION_NAMES } from './permissions';

export const SCHEDULE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const MEETING_TYPE = {
  MEETING: 'meeting',
  SITE_SURVEY: 'site_survey',
  TRAINING: 'training',
} as const;

export const MEETING_TYPE_LABELS: Record<string, string> = {
  [MEETING_TYPE.MEETING]: 'Họp',
  [MEETING_TYPE.SITE_SURVEY]: 'Khảo sát hiện trường',
  [MEETING_TYPE.TRAINING]: 'Bồi dưỡng/Tập huấn',
};

export const MEETING_TYPE_COLORS: Record<string, string> = {
  [MEETING_TYPE.MEETING]: '#6366f1',
  [MEETING_TYPE.SITE_SURVEY]: '#10b981',
  [MEETING_TYPE.TRAINING]: '#8b5cf6',
};

export const MEETING_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
} as const;

export const MEETING_STATUS_LABELS: Record<string, string> = {
  [MEETING_STATUS.PENDING]: 'Chờ duyệt',
  [MEETING_STATUS.APPROVED]: 'Đã duyệt',
  [MEETING_STATUS.REJECTED]: 'Từ chối',
  [MEETING_STATUS.CANCELLED]: 'Đã huỷ',
};

export const MEETING_STATUS_COLORS: Record<string, string> = {
  [MEETING_STATUS.PENDING]: '#f59e0b',
  [MEETING_STATUS.APPROVED]: '#10b981',
  [MEETING_STATUS.REJECTED]: '#ef4444',
  [MEETING_STATUS.CANCELLED]: '#64748b',
};

export const SCHEDULE_STATUS_LABELS: Record<string, string> = {
  [SCHEDULE_STATUS.DRAFT]: 'Nháp',
  [SCHEDULE_STATUS.PENDING]: 'Chờ duyệt',
  [SCHEDULE_STATUS.APPROVED]: 'Đã duyệt',
  [SCHEDULE_STATUS.CONFIRMED]: 'Đã xác nhận',
  [SCHEDULE_STATUS.REJECTED]: 'Từ chối',
  [SCHEDULE_STATUS.CANCELLED]: 'Đã xoá',
};

export const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  [SCHEDULE_STATUS.DRAFT]: '#94a3b8',
  [SCHEDULE_STATUS.PENDING]: '#f59e0b',
  [SCHEDULE_STATUS.APPROVED]: '#10b981',
  [SCHEDULE_STATUS.CONFIRMED]: '#6366f1',
  [SCHEDULE_STATUS.REJECTED]: '#ef4444',
  [SCHEDULE_STATUS.CANCELLED]: '#64748b',
};

export const STATUS_COLORS: Record<string, string> = {
  [SCHEDULE_STATUS.PENDING]: '#f59e0b',
  [SCHEDULE_STATUS.APPROVED]: '#10b981',
  [SCHEDULE_STATUS.REJECTED]: '#ef4444',
  [SCHEDULE_STATUS.CANCELLED]: '#64748b',
};

export const FIELD_NAMES = {
  IS_ACTIVE: 'is_active',
  IS_OFFICE_HOURS: 'is_office_hours',
  EMPLOYEE_NAME: 'employee_name',
  SHIFT_NAME: 'shift_name',
  TOTAL_HOURS: 'total_hours',
  IS_OVERTIME: 'is_overtime',
} as const;

export const DATE_FORMATS = {
  ISO_DATE: 'YYYY-MM-DD',
  ISO_MONTH: 'YYYY-MM',
  DISPLAY_DATE: 'DD/MM/YYYY',
  DISPLAY_MONTH: 'MM/YYYY',
  DISPLAY_DAY_MONTH: 'DD/MM',
  TIME_HH_MM: 'HH:mm',
  TIME_HH_MM_SS: 'HH:mm:ss',
};

export const QUERY_PARAMS = {
  ACTIVE_ONLY: 'active_only',
  DEPARTMENT_ID: 'department_id',
  MONTH: 'month',
  DATE_FROM: 'date_from',
  DATE_TO: 'date_to',
  STATUS: 'status',
  SEARCH: 'search',
  EMPLOYEE_ID: 'employee_id',
  REASON: 'reason',
};

export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Không thể tải dữ liệu',
  SAVE_FAILED: 'Lỗi khi lưu',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  FORBIDDEN: 'Bạn không có quyền thực hiện hành động này',
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Đăng nhập thành công',
  SCHEDULE_UPDATED: 'Đã cập nhật lịch trực',
  SCHEDULE_DELETED: 'Đã xoá lịch trực',
  SCHEDULE_SUBMITTED: 'Đã gửi phê duyệt',
  SCHEDULE_APPROVED: 'Đã duyệt lịch trực',
  SCHEDULE_REJECTED: 'Đã từ chối lịch trực',
};

export const LABELS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng',
  YES: 'Có',
  NO: 'Không',
  CANCEL: 'Huỷ',
  DELETE: 'Xoá',
  CONFIRM_DELETE_TITLE: 'Xoá lịch trực này?',
};

export const COLORS = {
  LAYOUT_BG: '#f0f4ff',
  PRIMARY_BLUE: '#1890ff',
  ERROR_RED: '#ff4d4f',
  WHITE: '#fff',
  BORDER_LIGHT: '#e8edf5',
  BORDER_DEFAULT: '#e0e6ef',
  DANGER_HOVER_BG: '#fee2e2',
  DANGER_HOVER_COLOR: '#ef4444',
  MENU_ITEM_COLOR: '#cbd5e1',
  MENU_ITEM_SELECTED_BG: 'rgba(255,255,255,0.12)',
  MENU_ITEM_SELECTED_COLOR: '#ffffff',
  MENU_ITEM_HOVER_BG: 'rgba(255,255,255,0.08)',
  SIDEBAR_BG: '#1e1b4b',
  SIDEBAR_BG_GRADIENT: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 40%, #3730a3 100%)',
  SIDEBAR_LOGO_BG: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  SIDEBAR_LOGO_SHADOW: 'rgba(99,102,241,0.4)',
  SIDEBAR_TEXT: '#cbd5e1',
  SIDEBAR_TEXT_MUTED: '#64748b',
  TOPBAR_BG: 'rgba(255,255,255,0.45)',
  TOPBAR_BLUR: '16px',
  TOPBAR_BORDER: 'rgba(255,255,255,0.4)',
  TOPBAR_SHADOW: '0 4px 20px rgba(0,0,0,0.06)',
  ACCENT_PURPLE: '#8b5cf6',
  ACCENT_INDIGO: '#6366f1',
  ACCENT_TEAL: '#0ea5e9',
  ACCENT_EMERALD: '#10b981',
  ACCENT_AMBER: '#f59e0b',
  ACCENT_ROSE: '#f43f5e',
  CARD_BORDER_TOP: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
  LOGIN_BG: '#f0f2f5',
  TRANSPARENT: 'transparent',
  TEXT_SECONDARY: '#64748b',
  TEXT_PRIMARY: '#1e293b',
};

export const BORDER_RADIUS = {
  CARD: 16,
  CARD_SMALL: 12,
  MENU_ITEM: 10,
  AVATAR: 8,
};

export const STATUS_TAG_LABELS: Record<string, string> = {
  [SCHEDULE_STATUS.DRAFT]: 'Nháp',
  [SCHEDULE_STATUS.PENDING]: 'Chờ duyệt',
  [SCHEDULE_STATUS.APPROVED]: 'Đã duyệt',
  [SCHEDULE_STATUS.CONFIRMED]: 'Đã xác nhận',
  [SCHEDULE_STATUS.REJECTED]: 'Từ chối',
  [SCHEDULE_STATUS.CANCELLED]: 'Đã xoá',
};
