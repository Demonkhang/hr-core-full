export interface ShiftTemplate {
  id: string;
  workplace_id: string;
  department_ids: string[];
  name: string;
  start_time: string;
  end_time: string;
  is_overnight: boolean;
  color: string;
  is_active: boolean;
  workplace_name: string | null;
  department_names: string[];
  created_at: string | null;
  updated_at: string | null;
}

import { SCHEDULE_STATUS } from '@/utils/constants';

export type ScheduleStatus = (typeof SCHEDULE_STATUS)[keyof typeof SCHEDULE_STATUS];

export interface Schedule {
  id: string;
  employee_id: string;
  shift_template_id: string;
  workplace_id: string | null;
  date: string;
  status: ScheduleStatus;
  actual_start_time: string | null;
  actual_end_time: string | null;
  total_hours: number | null;
  is_overtime: boolean;
  is_overtime_approved: boolean;
  notes: string | null;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  adjusted_from_id: string | null;
  employee_name: string | null;
  shift_name: string | null;
  shift_color: string | null;
  workplace_name: string | null;
  department_name: string | null;
  created_at: string | null;
}

export interface CalendarCell {
  date: string;
  schedules: Schedule[];
}

export interface CalendarResponse {
  month: string;
  department_id: string;
  cells: CalendarCell[];
}

export interface ScheduleCreate {
  employee_id: string;
  shift_template_id: string;
  workplace_id?: string;
  date: string;
  notes?: string;
}

export interface ScheduleUpdate {
  shift_template_id?: string;
  workplace_id?: string;
  notes?: string;
}

export interface BulkScheduleCreate {
  schedules: { employee_id: string; shift_template_id: string; workplace_id?: string; date: string }[];
  department_id: string;
}

export interface CoverageReport {
  date: string;
  total_shifts: number;
  gaps: { start: string; end: string }[];
  is_fully_covered: boolean;
  covered_ranges: {
    start: string;
    end: string;
    employee_name: string;
    shift_name: string;
  }[];
}
