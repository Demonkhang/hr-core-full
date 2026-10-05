export interface DashboardStats {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  total_departments: number;
  total_workplaces: number;
  total_job_positions: number;
  account_count: number;
}

export interface DepartmentDistribution {
  department_id: string;
  department_name: string;
  employee_count: number;
}

export interface WorkplaceDistribution {
  workplace_id: string;
  workplace_name: string;
  employee_count: number;
}

export interface JobPositionCapacity {
  id: string;
  name: string;
  department_name?: string;
  professional_level: number;
  current_headcount: number;
  max_headcount: number;
}

export interface QualificationDistribution {
  level: string;
  count: number;
}

export interface RecentActivity {
  id: string;
  action: string;
  resource_type: string;
  user_name: string;
  user_username?: string;
  created_at?: string;
  success: boolean;
}

export interface RecentHire {
  id: string;
  full_name: string;
  employee_code?: string;
  department_name?: string;
  position_name?: string;
  hire_date?: string;
}

export interface DashboardData {
  stats: DashboardStats;
  department_distribution: DepartmentDistribution[];
  workplace_distribution: WorkplaceDistribution[];
  qualification_distribution: QualificationDistribution[];
  headcount_capacity: JobPositionCapacity[];
  recent_activities: RecentActivity[];
  recent_hires: RecentHire[];
}
