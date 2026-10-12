import apiClient from './apiClient';
import { API_ENDPOINTS } from '@/utils/constants';
import type { DepartmentScheduleReport } from '@/types/report';

export const reportService = {
  async getMonthlySummary(params: { department_id?: string[]; month?: string }): Promise<any[]> {
    const res = await apiClient.get(API_ENDPOINTS.REPORTS_MONTHLY_SUMMARY, { params });
    return res.data;
  },

  async getDepartmentScheduleReport(params: {
    date_from: string;
    date_to: string;
    department_id?: string[];
  }): Promise<DepartmentScheduleReport[]> {
    const res = await apiClient.get(API_ENDPOINTS.REPORTS_DEPT_SCHEDULE, { params });
    return res.data;
  },

  async finalizeMonthlySummary(month: string): Promise<any> {
    const res = await apiClient.post(`${API_ENDPOINTS.REPORTS_MONTHLY_SUMMARY}/finalize`, null, {
      params: { month },
    });
    return res.data;
  },
};

