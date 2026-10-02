export { API_ENDPOINTS } from './apiEndpoints';
export { ROUTES, STORAGE_KEYS } from './routes';
export { SCOPE, SCOPE_LABELS, SCOPE_COLORS, SCOPE_OPTIONS, PERMISSIONS, PERMISSION_NAMES } from './permissions';

/** Định dạng ngày tháng (ISO / hiển thị) */
export const DATE_FORMATS = {
  ISO_DATE: 'YYYY-MM-DD',
  ISO_MONTH: 'YYYY-MM',
  DISPLAY_DATE: 'DD/MM/YYYY',
  DISPLAY_MONTH: 'MM/YYYY',
  DISPLAY_DAY_MONTH: 'DD/MM',
  TIME_HH_MM: 'HH:mm',
  TIME_HH_MM_SS: 'HH:mm:ss',
};

/** Tên tham số query dùng trong API */
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

/** Thông báo lỗi mặc định */
export const ERROR_MESSAGES = {
  LOAD_FAILED: 'Không thể tải dữ liệu',
  SAVE_FAILED: 'Lỗi khi lưu',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  FORBIDDEN: 'Bạn không có quyền thực hiện hành động này',
};

/** Thông báo thành công mặc định */
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Đăng nhập thành công',
};

/** Nhãn chung dùng trong UI */
export const LABELS = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng',
  YES: 'Có',
  NO: 'Không',
  CANCEL: 'Huỷ',
  DELETE: 'Xoá',
  CONFIRM_DELETE_TITLE: 'Xoá lịch trực này?',
};

/** Màu sắc dùng trong layout */
export const COLORS = {
  LAYOUT_BG: '#f8fafc',
  PRIMARY_BLUE: '#1890ff',
  ERROR_RED: '#ff4d4f',
  WHITE: '#fff',
  BORDER_LIGHT: '#f1f5f9',
  BORDER_DEFAULT: '#f0f0f0',
  DANGER_HOVER_BG: '#fee2e2',
  DANGER_HOVER_COLOR: '#ef4444',
  MENU_ITEM_COLOR: '#475569',
  MENU_ITEM_SELECTED_BG: '#ede9fe',
  MENU_ITEM_SELECTED_COLOR: '#7c3aed',
  MENU_ITEM_HOVER_BG: '#f1f5f9',
  SIDEBAR_BG: '#ffffff',
  TRANSPARENT: 'transparent',
  TEXT_SECONDARY: '#94a3b8',
  TEXT_PRIMARY: '#334155',
  LOGIN_BG: '#f0f2f5',
};

/** Giá trị border-radius dùng chung */
export const BORDER_RADIUS = {
  CARD: 16,
  CARD_SMALL: 12,
  MENU_ITEM: 10,
  AVATAR: 8,
};

/** Tên field dùng trong form / table */
export const FIELD_NAMES = {
  IS_ACTIVE: 'is_active',
  IS_OFFICE_HOURS: 'is_office_hours',
  EMPLOYEE_NAME: 'employee_name',
};

/** Trình độ chuyên môn tối thiểu cho vị trí việc làm */
export const QUALIFICATION_LEVELS: { label: string; value: string }[] = [
  { label: 'Chưa qua đào tạo', value: 'Chưa qua đào tạo' },
  { label: 'Sơ cấp', value: 'Sơ cấp' },
  { label: 'Trung cấp', value: 'Trung cấp' },
  { label: 'Cao đẳng', value: 'Cao đẳng' },
  { label: 'Cao đẳng nghề', value: 'Cao đẳng nghề' },
  { label: 'Đại học', value: 'Đại học' },
  { label: 'Thạc sĩ', value: 'Thạc sĩ' },
  { label: 'Tiến sĩ', value: 'Tiến sĩ' },
];

/** Bậc nghề nghiệp (1 -> 5) */
export const PROFESSIONAL_LEVELS: { label: string; value: number }[] = [
  { label: 'Bậc 1', value: 1 },
  { label: 'Bậc 2', value: 2 },
  { label: 'Bậc 3', value: 3 },
  { label: 'Bậc 4', value: 4 },
  { label: 'Bậc 5', value: 5 },
];
