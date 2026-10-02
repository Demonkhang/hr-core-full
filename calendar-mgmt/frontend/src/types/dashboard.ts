export interface DashboardData {
  stats: DashboardStats;
  department_distribution: DepartmentDistribution[];
  monthly_trend: MonthlyTrend[];
  schedule_by_status: Record<string, number>;
  overtime_by_department: OvertimeByDepartment[];
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  today_schedules: {
    total: number;
    approved: number;
    pending: number;
    overtime: number;
  };
  month_summary: {
    total_hours: number;
    overtime_hours: number;
    total_shifts: number;
  };
  pending_approvals: {
    schedules: number;
    overtime: number;
  };
}

export interface DepartmentDistribution {
  department_id: string;
  department_name: string;
  employee_count: number;
}

export interface MonthlyTrend {
  month: string;
  total_hours: number;
  overtime_hours: number;
  total_shifts: number;
}

export interface OvertimeByDepartment {
  department_id: string;
  department_name: string;
  total_ot_hours: number;
}
