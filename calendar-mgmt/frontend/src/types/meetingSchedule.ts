export type MeetingType = 'recurring' | 'ad_hoc' | 'department';
export type MeetingStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface MeetingParticipant {
  id: string;
  employee_id: string;
  employee_name?: string;
  department_name?: string;
  response_status: 'pending' | 'accepted' | 'rejected' | 'tentative';
  created_at: string | null;
}

export interface MeetingSchedule {
  id: string;
  title: string;
  meeting_type: MeetingType;
  date: string;
  start_time: string;
  location?: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  created_by_id?: string;
  created_by_name?: string;
  status: MeetingStatus;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  is_active: boolean;
  participants?: MeetingParticipant[];
  participant_count?: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface MeetingScheduleCreate {
  title: string;
  meeting_type: MeetingType;
  date: string;
  start_time: string;
  location?: string;
  description?: string;
  department_id?: string;
  participant_ids?: string[];
}

export interface MeetingScheduleUpdate {
  title?: string;
  meeting_type?: MeetingType;
  date?: string;
  start_time?: string;
  location?: string;
  description?: string;
  department_id?: string;
  participant_ids?: string[];
}

export interface MeetingScheduleFilter {
  employee_id?: string;
  department_id?: string | string[];
  status?: MeetingStatus;
  meeting_type?: MeetingType;
  date_from?: string;
  date_to?: string;
  active_only?: boolean;
}
