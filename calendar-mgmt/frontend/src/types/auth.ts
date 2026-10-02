export interface UserPermissions {
  scope: string;
  can_read_schedule: boolean;
  can_create_schedule: boolean;
  can_update_schedule: boolean;
  can_delete_schedule: boolean;
  can_approve_schedule: boolean;
  can_manage_employees: boolean;
  can_manage_departments: boolean;
  can_manage_workplaces: boolean;
  can_manage_settings: boolean;
  can_manage_users: boolean;
  can_view_reports: boolean;
  can_manage_leave: boolean;
  can_approve_leave: boolean;
  can_manage_overtime: boolean;
  can_approve_overtime: boolean;
  can_manage_meetings: boolean;
  can_approve_meetings: boolean;
}

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  department_id: string | null;
  employee_id: string | null;
  must_change_password?: boolean;
  permissions: UserPermissions;
}

export interface LoginRequest {
  username: string;
  password: string;
  remember_me?: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password?: boolean;
}
