export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  employee_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DepartmentCreate {
  name: string;
  code: string;
  description?: string;
}
