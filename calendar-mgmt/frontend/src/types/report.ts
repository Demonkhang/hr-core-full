export interface ScheduleDetail {
  id: string;
  date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  status: string;
  total_hours: number;
  is_overtime: boolean;
  workplace_name: string;
}

export interface EmployeeScheduleSummary {
  employee_id: string;
  employee_name: string;
  total_shifts: number;
  total_hours: number;
  overtime_hours: number;
  schedules: ScheduleDetail[];
}

export interface DepartmentScheduleReport {
  department_id: string;
  department_name: string;
  total_employees: number;
  total_shifts: number;
  total_hours: number;
  overtime_hours: number;
  employees: EmployeeScheduleSummary[];
}
