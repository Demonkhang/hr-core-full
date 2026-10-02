export interface Employee {
  id: string;
  department_id: string;
  workplace_id: string | null;
  position_id: string | null;
  full_name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  employee_code: string | null;
  hire_date: string | null;
  is_active: boolean;
  status: string | null;
  department_name: string | null;
  workplace_name: string | null;
  position_name: string | null;
  has_account: boolean;
  user_id: string | null;
  username: string | null;
  is_super_admin: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface EmployeeCreate {
  department_id: string;
  workplace_id?: string;
  position_id?: string;
  full_name: string;
  position?: string;
  phone?: string;
  email?: string;
  employee_code?: string;
  hire_date?: string;
  create_account?: boolean;
}
