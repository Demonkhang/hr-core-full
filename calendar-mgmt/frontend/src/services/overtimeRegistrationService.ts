import apiClient from './apiClient';
import { API_ENDPOINTS } from '@/utils/apiEndpoints';
import type { OvertimeRegistration, OvertimeRegistrationCreate } from '@/types/overtimeRegistration';

export const overtimeRegistrationService = {
  async list(params?: {
    employee_id?: string;
    department_id?: string | string[];
    status?: string;
    date_from?: string;
    date_to?: string;
    active_only?: boolean;
  }): Promise<OvertimeRegistration[]> {
    const res = await apiClient.get(API_ENDPOINTS.OVERTIME_REGISTRATIONS, { params });
    return res.data;
  },

  async get(id: string): Promise<OvertimeRegistration> {
    const res = await apiClient.get(API_ENDPOINTS.OVERTIME_REGISTRATION(id));
    return res.data;
  },

  async create(data: OvertimeRegistrationCreate): Promise<OvertimeRegistration> {
    const res = await apiClient.post(API_ENDPOINTS.OVERTIME_REGISTRATIONS, data);
    return res.data;
  },

  async update(id: string, data: Partial<OvertimeRegistrationCreate>): Promise<OvertimeRegistration> {
    const res = await apiClient.put(API_ENDPOINTS.OVERTIME_REGISTRATION(id), data);
    return res.data;
  },

  async approve(id: string): Promise<OvertimeRegistration> {
    const res = await apiClient.post(API_ENDPOINTS.OVERTIME_REGISTRATION_APPROVE(id));
    return res.data;
  },

  async reject(id: string, reason: string): Promise<OvertimeRegistration> {
    const res = await apiClient.post(API_ENDPOINTS.OVERTIME_REGISTRATION_REJECT(id), null, { params: { reason } });
    return res.data;
  },

  async bulkApprove(registrationIds: string[]): Promise<{ approved: OvertimeRegistration[]; errors: any[]; total: number; success_count: number; error_count: number }> {
    const res = await apiClient.post(API_ENDPOINTS.OVERTIME_REGISTRATIONS_BULK_APPROVE, { registration_ids: registrationIds });
    return res.data;
  },

  async bulkReject(registrationIds: string[], reason: string): Promise<{ rejected: OvertimeRegistration[]; errors: any[]; total: number; success_count: number; error_count: number }> {
    const res = await apiClient.post(API_ENDPOINTS.OVERTIME_REGISTRATIONS_BULK_REJECT, { registration_ids: registrationIds, reason });
    return res.data;
  },

  async deactivate(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.OVERTIME_REGISTRATION(id));
  },
};
