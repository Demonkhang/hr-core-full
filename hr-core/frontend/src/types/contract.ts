export type ContractTypeValue = 'probation' | 'definite_term' | 'indefinite_term' | 'internship' | 'collaborator';
export type ContractStatusValue = 'active' | 'pending_renewal' | 'renewed' | 'expired' | 'terminated';
export type ContractAppendixChangeTypeValue = 'salary' | 'position' | 'workplace' | 'term_extension' | 'other';

export const CONTRACT_TYPE_LABELS: Record<ContractTypeValue, string> = {
  probation: 'Thử việc',
  definite_term: 'Xác định thời hạn',
  indefinite_term: 'Không xác định thời hạn',
  internship: 'Thực tập / Học nghề',
  collaborator: 'Cộng tác viên / Khoán việc',
};

export const CONTRACT_TYPE_COLORS: Record<ContractTypeValue, string> = {
  probation: 'purple',
  definite_term: 'blue',
  indefinite_term: 'cyan',
  internship: 'gold',
  collaborator: 'geekblue',
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatusValue, string> = {
  active: 'Đang hiệu lực',
  pending_renewal: 'Chờ tái ký',
  renewed: 'Đã tái ký',
  expired: 'Đã hết hạn',
  terminated: 'Đã chấm dứt',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatusValue, string> = {
  active: '#10b981',
  pending_renewal: '#f59e0b',
  renewed: '#3b82f6',
  expired: '#ef4444',
  terminated: '#64748b',
};

export const APPENDIX_CHANGE_TYPE_LABELS: Record<ContractAppendixChangeTypeValue, string> = {
  salary: 'Điều chỉnh lương / phụ cấp',
  position: 'Thay đổi vị trí / chức danh',
  workplace: 'Thay đổi địa điểm làm việc',
  term_extension: 'Gia hạn thời hạn hợp đồng',
  other: 'Nội dung khác',
};

export interface ContractAppendix {
  id: string;
  contract_id: string;
  appendix_number: string;
  effective_date: string;
  change_type: ContractAppendixChangeTypeValue;
  content: string;
  new_basic_salary?: number | null;
  new_end_date?: string | null;
  file_attachment_url?: string | null;
  signing_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface ContractAppendixCreate {
  appendix_number: string;
  effective_date: string;
  change_type: ContractAppendixChangeTypeValue;
  content: string;
  new_basic_salary?: number;
  new_end_date?: string;
  file_attachment_url?: string;
  signing_date: string;
}

export interface Contract {
  id: string;
  employee_id: string;
  contract_number: string;
  contract_type: ContractTypeValue;
  contract_sequence: number;
  start_date: string;
  end_date: string | null;
  signing_date: string;
  signatory_name: string | null;
  signatory_title: string | null;
  job_title: string | null;
  department_id: string | null;
  workplace_id: string | null;
  basic_salary: number | null;
  salary_rate: number;
  allowance_amount: number;
  working_hours_description: string | null;
  notes: string | null;
  status: ContractStatusValue;
  termination_date: string | null;
  termination_reason: string | null;
  file_attachment_url: string | null;
  employee_name?: string | null;
  employee_code?: string | null;
  department_name?: string | null;
  workplace_name?: string | null;
  days_remaining?: number | null;
  is_expiring_soon?: boolean;
  is_expired?: boolean;
  appendices?: ContractAppendix[];
  created_at?: string;
  updated_at?: string;
}

export interface ContractCreate {
  employee_id: string;
  contract_number: string;
  contract_type: ContractTypeValue;
  contract_sequence?: number;
  start_date: string;
  end_date?: string | null;
  signing_date: string;
  signatory_name?: string;
  signatory_title?: string;
  job_title?: string;
  department_id?: string;
  workplace_id?: string;
  basic_salary?: number;
  salary_rate?: number;
  allowance_amount?: number;
  working_hours_description?: string;
  notes?: string;
  file_attachment_url?: string;
}

export interface ContractUpdate {
  contract_number?: string;
  contract_type?: ContractTypeValue;
  contract_sequence?: number;
  start_date?: string;
  end_date?: string | null;
  signing_date?: string;
  signatory_name?: string;
  signatory_title?: string;
  job_title?: string;
  department_id?: string;
  workplace_id?: string;
  basic_salary?: number;
  salary_rate?: number;
  allowance_amount?: number;
  working_hours_description?: string;
  status?: ContractStatusValue;
  notes?: string;
  file_attachment_url?: string;
}

export interface ContractRenewRequest {
  contract_number: string;
  contract_type: ContractTypeValue;
  start_date: string;
  end_date?: string | null;
  signing_date: string;
  signatory_name?: string;
  signatory_title?: string;
  job_title?: string;
  basic_salary?: number;
  salary_rate?: number;
  allowance_amount?: number;
  notes?: string;
  file_attachment_url?: string;
}

export interface ContractTerminateRequest {
  termination_date: string;
  termination_reason: string;
  deactivate_employee?: boolean;
}

export interface ContractDashboardSummary {
  total_active: number;
  expiring_15_days: number;
  expiring_30_days: number;
  expiring_60_days: number;
  overdue_count: number;
  indefinite_count: number;
  definite_count: number;
  probation_count: number;
}
