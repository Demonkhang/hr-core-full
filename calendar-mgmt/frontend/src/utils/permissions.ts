export const SCOPE = {
  ORGANIZATION: 'organization',
  DEPARTMENT: 'department',
  SELF: 'self',
} as const;

export const SCOPE_LABELS: Record<string, string> = {
  [SCOPE.ORGANIZATION]: 'Toàn bộ cơ quan',
  [SCOPE.DEPARTMENT]: 'Trong phòng',
  [SCOPE.SELF]: 'Chỉ mình',
};

export const SCOPE_COLORS: Record<string, string> = {
  [SCOPE.ORGANIZATION]: 'red',
  [SCOPE.DEPARTMENT]: 'blue',
  [SCOPE.SELF]: 'green',
};

export const SCOPE_OPTIONS = [
  { label: SCOPE_LABELS[SCOPE.ORGANIZATION], value: SCOPE.ORGANIZATION },
  { label: SCOPE_LABELS[SCOPE.DEPARTMENT], value: SCOPE.DEPARTMENT },
  { label: SCOPE_LABELS[SCOPE.SELF], value: SCOPE.SELF },
];

export const PERMISSIONS = {
  CAN_READ_SCHEDULE: 'can_read_schedule',
  CAN_CREATE_SCHEDULE: 'can_create_schedule',
  CAN_UPDATE_SCHEDULE: 'can_update_schedule',
  CAN_DELETE_SCHEDULE: 'can_delete_schedule',
  CAN_APPROVE_SCHEDULE: 'can_approve_schedule',
  CAN_MANAGE_EMPLOYEES: 'can_manage_employees',
  CAN_MANAGE_DEPARTMENTS: 'can_manage_departments',
  CAN_MANAGE_WORKPLACES: 'can_manage_workplaces',
  CAN_MANAGE_SETTINGS: 'can_manage_settings',
  CAN_MANAGE_USERS: 'can_manage_users',
  CAN_MANAGE_LEAVE: 'can_manage_leave',
  CAN_APPROVE_LEAVE: 'can_approve_leave',
  CAN_MANAGE_OVERTIME: 'can_manage_overtime',
  CAN_APPROVE_OVERTIME: 'can_approve_overtime',
  CAN_MANAGE_MEETINGS: 'can_manage_meetings',
  CAN_APPROVE_MEETINGS: 'can_approve_meetings',
  CAN_VIEW_REPORTS: 'can_view_reports',
} as const;

export const PERMISSION_NAMES: Record<string, string> = {
  [PERMISSIONS.CAN_READ_SCHEDULE]: 'Xem lịch',
  [PERMISSIONS.CAN_CREATE_SCHEDULE]: 'Tạo lịch',
  [PERMISSIONS.CAN_UPDATE_SCHEDULE]: 'Sửa lịch',
  [PERMISSIONS.CAN_DELETE_SCHEDULE]: 'Xóa lịch',
  [PERMISSIONS.CAN_APPROVE_SCHEDULE]: 'Duyệt lịch',
  [PERMISSIONS.CAN_MANAGE_EMPLOYEES]: 'Quản lý nhân sự',
  [PERMISSIONS.CAN_MANAGE_DEPARTMENTS]: 'Quản lý phòng ban',
  [PERMISSIONS.CAN_MANAGE_WORKPLACES]: 'Quản lý nơi làm việc',
  [PERMISSIONS.CAN_MANAGE_SETTINGS]: 'Quản lý cấu hình',
  [PERMISSIONS.CAN_MANAGE_USERS]: 'Quản lý người dùng',
  [PERMISSIONS.CAN_MANAGE_LEAVE]: 'Quản lý nghỉ phép',
  [PERMISSIONS.CAN_APPROVE_LEAVE]: 'Duyệt nghỉ phép',
  [PERMISSIONS.CAN_MANAGE_OVERTIME]: 'Quản lý thêm giờ',
  [PERMISSIONS.CAN_APPROVE_OVERTIME]: 'Duyệt thêm giờ',
  [PERMISSIONS.CAN_MANAGE_MEETINGS]: 'Quản lý lịch họp',
  [PERMISSIONS.CAN_APPROVE_MEETINGS]: 'Duyệt lịch họp',
  [PERMISSIONS.CAN_VIEW_REPORTS]: 'Xem báo cáo',
};
