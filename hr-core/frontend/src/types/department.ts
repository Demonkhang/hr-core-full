export interface DepartmentHead {
  id: string;
  full_name: string;
  employee_code: string | null;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  head_id: string | null;
  head: DepartmentHead | null;
  employee_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DepartmentCreate {
  name: string;
  code: string;
  description?: string;
  head_id?: string | null;
}
