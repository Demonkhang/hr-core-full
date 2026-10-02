export interface SalaryHistory {
  id: string;
  employee_id: string;
  coefficient: number;
  allowance_coefficient: number;
  effective_date: string;
  decision_number: string | null;
  notes: string | null;
  employee_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SalaryHistoryCreate {
  coefficient: number;
  allowance_coefficient?: number;
  effective_date: string;
  decision_number?: string;
  notes?: string;
}

export interface BaseSalaryConfig {
  id: string;
  year: number;
  amount: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface BaseSalaryConfigCreate {
  year: number;
  amount: number;
}

export interface Qualification {
  id: string;
  employee_id: string;
  name: string;
  issuing_body: string | null;
  issue_date: string;
  expiry_date: string | null;
  credential_type: string;
  classification: string | null;
  major: string | null;
  certificate_number: string | null;
  training_form: string | null;
  notes: string | null;
  employee_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface QualificationCreate {
  name: string;
  issuing_body?: string;
  issue_date: string;
  expiry_date?: string;
  credential_type: string;
  classification?: string;
  major?: string;
  certificate_number?: string;
  training_form?: string;
  notes?: string;
}
