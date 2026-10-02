import apiClient from './apiClient';
import type {
  Schedule,
  ScheduleCreate,
  ScheduleUpdate,
  CalendarResponse,
  BulkScheduleCreate,
  CoverageReport,
} from '@/types/schedule';
import { API_ENDPOINTS } from '@/utils/constants';

export const scheduleService = {
  async list(params?: {
    department_id?: string | string[];
    employee_id?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
    include_cancelled?: boolean;
  }): Promise<Schedule[]> {
    const res = await apiClient.get(API_ENDPOINTS.SCHEDULES, { params });
    return res.data;
  },

  async getCalendar(month: string, departmentIds: string | string[]): Promise<CalendarResponse> {
    const res = await apiClient.get(API_ENDPOINTS.SCHEDULES_CALENDAR, {
      params: { month, department_id: departmentIds },
    });
    return res.data;
  },

  async getCoverage(date: string, departmentIds: string | string[]): Promise<CoverageReport> {
    const res = await apiClient.get(API_ENDPOINTS.SCHEDULES_COVERAGE, {
      params: { date, department_id: departmentIds },
    });
    return res.data;
  },

  async create(data: ScheduleCreate): Promise<Schedule> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULES, data);
    return res.data;
  },

  async bulkCreate(data: BulkScheduleCreate): Promise<{ created: number; errors: any[] }> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULES_BULK_CREATE, data);
    return res.data;
  },

  async submit(scheduleId: string): Promise<Schedule> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULE_SUBMIT(scheduleId));
    return res.data;
  },

  async approve(scheduleId: string): Promise<Schedule> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULE_APPROVE(scheduleId));
    return res.data;
  },

  async reject(scheduleId: string, reason: string): Promise<Schedule> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULE_REJECT(scheduleId), null, {
      params: { reason },
    });
    return res.data;
  },

  async bulkApprove(scheduleIds: string[]): Promise<{ approved: Schedule[]; errors: any[]; total: number; success_count: number; error_count: number }> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULES_BULK_APPROVE, { schedule_ids: scheduleIds });
    return res.data;
  },

  async bulkReject(scheduleIds: string[], reason: string): Promise<{ rejected: Schedule[]; errors: any[]; total: number; success_count: number; error_count: number }> {
    const res = await apiClient.post(API_ENDPOINTS.SCHEDULES_BULK_REJECT, { schedule_ids: scheduleIds, reason });
    return res.data;
  },

  async update(id: string, data: ScheduleUpdate): Promise<Schedule> {
    const res = await apiClient.put(API_ENDPOINTS.SCHEDULE(id), data);
    return res.data;
  },

  async delete(scheduleId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.SCHEDULE(scheduleId));
  },
};
