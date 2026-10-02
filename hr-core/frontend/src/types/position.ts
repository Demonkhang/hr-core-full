export interface Position {
  id: string;
  name: string;
  code: string;
  description: string | null;
  scope: string;
  can_manage_employees: boolean;
  can_manage_departments: boolean;
  can_manage_workplaces: boolean;
  can_manage_settings: boolean;
  can_manage_users: boolean;
  can_view_reports: boolean;
  is_active: boolean;
  employee_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PositionCreate {
  name: string;
  code: string;
  description?: string;
  scope?: string;
  can_manage_employees?: boolean;
  can_manage_departments?: boolean;
  can_manage_workplaces?: boolean;
  can_manage_settings?: boolean;
  can_manage_users?: boolean;
  can_view_reports?: boolean;
}
