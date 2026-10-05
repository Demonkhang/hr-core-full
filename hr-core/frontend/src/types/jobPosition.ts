export interface JobPosition {
  id: string;
  name: string;
  code: string;
  description: string | null;
  professional_level: number;
  workplace_id: string | null;
  workplace_name: string | null;
  required_qualification_level: string | null;
  required_specialty: string | null;
  max_headcount: number;
  is_active: boolean;
  current_headcount: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface JobPositionCreate {
  name: string;
  code: string;
  description?: string;
  professional_level?: number;
  workplace_id?: string | null;
  required_qualification_level?: string;
  required_specialty?: string;
  max_headcount?: number;
}

