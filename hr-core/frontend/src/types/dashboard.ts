export interface DashboardData {
  stats: DashboardStats;
  department_distribution: DepartmentDistribution[];
  qualification_distribution: QualificationDistribution[];
}

export interface DashboardStats {
  total_employees: number;
  active_employees: number;
}

export interface DepartmentDistribution {
  department_id: string;
  department_name: string;
  employee_count: number;
}

export interface QualificationDistribution {
  level: string;
  count: number;
}
