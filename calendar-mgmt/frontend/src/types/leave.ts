export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  total_allocated: number;
  carried_over: number;
  used: number;
  remaining: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  employee_name?: string;
  department_name?: string;
}

export interface LeaveBalanceCreate {
  employee_id: string;
  year: number;
  total_allocated: number;
  carried_over?: number;
  used?: number;
}

export interface LeaveBalanceUpdate {
  total_allocated?: number;
  carried_over?: number;
  used?: number;
  remaining?: number;
}

export type LeaveSession = 'full' | 'morning' | 'afternoon';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveType = 'annual' | 'sick' | 'personal_unpaid' | 'personal_paid' | 'maternity';

export interface LeaveRegistration {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  start_session: LeaveSession;
  end_session: LeaveSession;
  total_days: number;
  leave_type: LeaveType;
  reason?: string;
  status: LeaveStatus;
  approved_by_id?: string;
  approved_at?: string;
  rejection_reason?: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  employee_name?: string;
  department_name?: string;
}

export interface LeaveRegistrationCreate {
  employee_id: string;
  start_date: string;
  end_date: string;
  start_session?: LeaveSession;
  end_session?: LeaveSession;
  leave_type: LeaveType;
  reason?: string;
}

export interface LeaveRegistrationUpdate {
  start_date?: string;
  end_date?: string;
  start_session?: LeaveSession;
  end_session?: LeaveSession;
  leave_type?: LeaveType;
  reason?: string;
}

export interface LeaveRegistrationFilter {
  employee_id?: string;
  department_id?: string | string[];
  date_from?: string;
  date_to?: string;
  status?: LeaveStatus;
  leave_type?: LeaveType;
  skip?: number;
  limit?: number;
}
