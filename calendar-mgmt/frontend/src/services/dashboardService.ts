import apiClient from './apiClient';
import { API_ENDPOINTS } from '@/utils/constants';
import type { DashboardData } from '@/types/dashboard';

export const dashboardService = {
  async getDashboardData(params?: {
    month?: string;
    department_id?: string[];
  }): Promise<DashboardData> {
    const res = await apiClient.get(API_ENDPOINTS.DASHBOARD, { params });
    return res.data;
  },
};
