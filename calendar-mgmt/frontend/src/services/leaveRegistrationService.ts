import apiClient from './apiClient';
import { API_ENDPOINTS } from '../utils/apiEndpoints';
import { LeaveRegistration, LeaveRegistrationCreate, LeaveRegistrationUpdate, LeaveRegistrationFilter } from '../types/leave';

export const leaveRegistrationService = {
  getAll: async (filter: LeaveRegistrationFilter): Promise<LeaveRegistration[]> => {
    const params = new URLSearchParams();
    if (filter.employee_id) params.append('employee_id', filter.employee_id);
    if (filter.department_id) {
      const depts = Array.isArray(filter.department_id) ? filter.department_id : [filter.department_id];
      depts.forEach(id => params.append('department_id', id));
    }
    if (filter.date_from) params.append('date_from', filter.date_from);
    if (filter.date_to) params.append('date_to', filter.date_to);
    if (filter.status) params.append('status', filter.status);
    if (filter.leave_type) params.append('leave_type', filter.leave_type);
    if (filter.skip !== undefined) params.append('skip', filter.skip.toString());
    if (filter.limit !== undefined) params.append('limit', filter.limit.toString());

    const response = await apiClient.get<LeaveRegistration[]>(`${API_ENDPOINTS.LEAVE_REGISTRATIONS}?${params.toString()}`);
    return response.data;
  },

  getById: async (id: string): Promise<LeaveRegistration> => {
    const response = await apiClient.get<LeaveRegistration>(API_ENDPOINTS.LEAVE_REGISTRATION(id));
    return response.data;
  },

  create: async (data: LeaveRegistrationCreate): Promise<LeaveRegistration> => {
    const response = await apiClient.post<LeaveRegistration>(API_ENDPOINTS.LEAVE_REGISTRATIONS, data);
    return response.data;
  },

  update: async (id: string, data: LeaveRegistrationUpdate): Promise<LeaveRegistration> => {
    const response = await apiClient.put<LeaveRegistration>(API_ENDPOINTS.LEAVE_REGISTRATION(id), data);
    return response.data;
  },

  delete: async (id: string): Promise<any> => {
    const response = await apiClient.delete(API_ENDPOINTS.LEAVE_REGISTRATION(id));
    return response.data;
  },

  approve: async (id: string): Promise<LeaveRegistration> => {
    const response = await apiClient.post<LeaveRegistration>(API_ENDPOINTS.LEAVE_REGISTRATION_APPROVE(id));
    return response.data;
  },

  reject: async (id: string): Promise<LeaveRegistration> => {
    const response = await apiClient.post<LeaveRegistration>(API_ENDPOINTS.LEAVE_REGISTRATION_REJECT(id));
    return response.data;
  },

  bulkApprove: async (ids: string[]): Promise<any> => {
    const response = await apiClient.post(API_ENDPOINTS.LEAVE_REGISTRATIONS_BULK_APPROVE, { registration_ids: ids });
    return response.data;
  },

  bulkReject: async (ids: string[], reason: string): Promise<any> => {
    const response = await apiClient.post(API_ENDPOINTS.LEAVE_REGISTRATIONS_BULK_REJECT, { registration_ids: ids, reason });
    return response.data;
  },
};
