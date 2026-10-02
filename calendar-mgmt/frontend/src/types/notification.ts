export interface Notification {
  id: string;
  employee_id: string;
  schedule_id: string | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string | null;
}

export interface UnreadCount {
  count: number;
}
