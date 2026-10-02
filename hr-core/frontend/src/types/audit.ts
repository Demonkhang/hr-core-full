export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  success: boolean;
}

export interface AuditLogStats {
  total: number;
  by_action: { action: string; count: number }[];
  by_resource: { resource_type: string; count: number }[];
  by_date: { date: string; count: number }[];
}
