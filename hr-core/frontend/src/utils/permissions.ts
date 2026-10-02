/** Phạm vi quyền của user */
export const SCOPE = {
  ORGANIZATION: 'organization',
  DEPARTMENT: 'department',
  SELF: 'self',
} as const;

/** Nhãn hiển thị cho từng phạm vi quyền */
export const SCOPE_LABELS: Record<string, string> = {
  [SCOPE.ORGANIZATION]: 'Toàn bộ cơ quan',
  [SCOPE.DEPARTMENT]: 'Trong phòng',
  [SCOPE.SELF]: 'Chỉ mình',
};

/** Màu Tag cho từng phạm vi quyền */
export const SCOPE_COLORS: Record<string, string> = {
  [SCOPE.ORGANIZATION]: 'red',
  [SCOPE.DEPARTMENT]: 'blue',
  [SCOPE.SELF]: 'green',
};

/** Options cho Select phạm vi quyền */
export const SCOPE_OPTIONS = [
  { label: SCOPE_LABELS[SCOPE.ORGANIZATION], value: SCOPE.ORGANIZATION },
  { label: SCOPE_LABELS[SCOPE.DEPARTMENT], value: SCOPE.DEPARTMENT },
  { label: SCOPE_LABELS[SCOPE.SELF], value: SCOPE.SELF },
];

/** Danh sách quyền (permission key) */
export const PERMISSIONS = {
  CAN_MANAGE_EMPLOYEES: 'can_manage_employees',
  CAN_MANAGE_SETTINGS: 'can_manage_settings',
  CAN_MANAGE_USERS: 'can_manage_users',
  CAN_VIEW_REPORTS: 'can_view_reports',
} as const;

/** Tên hiển thị cho từng quyền */
export const PERMISSION_NAMES: Record<string, string> = {
  [PERMISSIONS.CAN_MANAGE_EMPLOYEES]: 'Quản lý nhân sự',
  [PERMISSIONS.CAN_MANAGE_SETTINGS]: 'Quản lý cấu hình',
  [PERMISSIONS.CAN_MANAGE_USERS]: 'Quản lý người dùng',
  [PERMISSIONS.CAN_VIEW_REPORTS]: 'Xem báo cáo',
};
