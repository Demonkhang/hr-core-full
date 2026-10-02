export interface OvertimeRegistration {
  id: string;
  employee_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  total_hours: number | null;
  reason: string | null;
  status: string;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  is_active: boolean;
  employee_name: string | null;
  department_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface OvertimeRegistrationCreate {
  employee_id: string;
  date: string;
  start_time?: string;
  end_time?: string;
  total_hours?: number;
  reason?: string;
}

export interface OvertimeRegistrationUpdate {
  start_time?: string;
  end_time?: string;
  total_hours?: number;
  reason?: string;
}
