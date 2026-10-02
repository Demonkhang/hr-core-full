import apiClient from './apiClient';
import { API_ENDPOINTS } from '../utils/apiEndpoints';
import type { MeetingSchedule, MeetingScheduleCreate, MeetingScheduleUpdate, MeetingScheduleFilter } from '../types/meetingSchedule';

export const meetingScheduleService = {
  getAll: async (filter?: MeetingScheduleFilter): Promise<MeetingSchedule[]> => {
    const params: Record<string, any> = {};
    if (filter) {
      if (filter.employee_id) params.employee_id = filter.employee_id;
      if (filter.department_id) {
        const depts = Array.isArray(filter.department_id) ? filter.department_id : [filter.department_id];
        params.department_id = depts;
      }
      if (filter.status) params.status = filter.status;
      if (filter.meeting_type) params.meeting_type = filter.meeting_type;
      if (filter.date_from) params.date_from = filter.date_from;
      if (filter.date_to) params.date_to = filter.date_to;
      if (filter.active_only !== undefined) params.active_only = filter.active_only;
    }
    const response = await apiClient.get<MeetingSchedule[]>(API_ENDPOINTS.MEETING_SCHEDULES, { params });
    return response.data;
  },

  getById: async (id: string): Promise<MeetingSchedule> => {
    const response = await apiClient.get<MeetingSchedule>(API_ENDPOINTS.MEETING_SCHEDULE(id));
    return response.data;
  },

  getByDate: async (date: string): Promise<MeetingSchedule[]> => {
    const response = await apiClient.get<MeetingSchedule[]>(API_ENDPOINTS.MEETING_SCHEDULES_BY_DATE(date));
    return response.data;
  },

  create: async (data: MeetingScheduleCreate): Promise<MeetingSchedule> => {
    const response = await apiClient.post<MeetingSchedule>(API_ENDPOINTS.MEETING_SCHEDULES, data);
    return response.data;
  },

  update: async (id: string, data: MeetingScheduleUpdate): Promise<MeetingSchedule> => {
    const response = await apiClient.put<MeetingSchedule>(API_ENDPOINTS.MEETING_SCHEDULE(id), data);
    return response.data;
  },

  delete: async (id: string): Promise<any> => {
    const response = await apiClient.delete(API_ENDPOINTS.MEETING_SCHEDULE(id));
    return response.data;
  },

  approve: async (id: string): Promise<MeetingSchedule> => {
    const response = await apiClient.post<MeetingSchedule>(API_ENDPOINTS.MEETING_SCHEDULE_APPROVE(id));
    return response.data;
  },

  reject: async (id: string, reason: string): Promise<MeetingSchedule> => {
    const response = await apiClient.post<MeetingSchedule>(API_ENDPOINTS.MEETING_SCHEDULE_REJECT(id), null, { params: { reason } });
    return response.data;
  },

  bulkApprove: async (ids: string[]): Promise<any> => {
    const response = await apiClient.post(API_ENDPOINTS.MEETING_SCHEDULES_BULK_APPROVE, { meeting_ids: ids });
    return response.data;
  },

  bulkReject: async (ids: string[], reason: string): Promise<any> => {
    const response = await apiClient.post(API_ENDPOINTS.MEETING_SCHEDULES_BULK_REJECT, { meeting_ids: ids, reason });
    return response.data;
  },
};
