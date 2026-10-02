export interface Workplace {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  is_office_hours: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface WorkplaceCreate {
  name: string;
  code?: string;
  address?: string;
  is_office_hours?: boolean;
}
