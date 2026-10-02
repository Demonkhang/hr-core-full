import apiClient from './apiClient';
import type { AuditLog, AuditLogStats } from '@/types/audit';

export interface AuditLogFilter {
  action?: string;
  actions?: string;
  resource_type?: string;
  resource_id?: string;
  user_id?: string;
  success?: boolean;
  date_from?: string;
  date_to?: string;
  skip?: number;
  limit?: number;
}

export interface AuditLogStatsFilter {
  date_from?: string;
  date_to?: string;
  actions?: string;
}

export const auditService = {
  async list(params?: AuditLogFilter): Promise<AuditLog[]> {
    const res = await apiClient.get('/audit-logs', { params });
    return res.data;
  },

  async get(id: string): Promise<AuditLog> {
    const res = await apiClient.get(`/audit-logs/${id}`);
    return res.data;
  },

  async getStats(params?: AuditLogStatsFilter): Promise<AuditLogStats> {
    const res = await apiClient.get('/audit-logs/stats', { params });
    return res.data;
  },
};
