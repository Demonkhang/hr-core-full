import apiClient from './apiClient';
import { API_ENDPOINTS } from '../utils/apiEndpoints';
import { LeaveBalance, LeaveBalanceCreate, LeaveBalanceUpdate } from '../types/leave';

export const leaveBalanceService = {
  getAll: async (skip: number = 0, limit: number = 100, year?: number, employeeId?: string): Promise<LeaveBalance[]> => {
    let url = `${API_ENDPOINTS.LEAVE_BALANCES}?skip=${skip}&limit=${limit}`;
    if (year) url += `&year=${year}`;
    if (employeeId) url += `&employee_id=${employeeId}`;
    const response = await apiClient.get<LeaveBalance[]>(url);
    return response.data;
  },

  getById: async (id: string): Promise<LeaveBalance> => {
    const response = await apiClient.get<LeaveBalance>(API_ENDPOINTS.LEAVE_BALANCE(id));
    return response.data;
  },

  getByEmployeeAndYear: async (employeeId: string, year: number): Promise<LeaveBalance> => {
    const response = await apiClient.get<LeaveBalance>(`${API_ENDPOINTS.LEAVE_BALANCES}/employee/${employeeId}/year/${year}`);
    return response.data;
  },

  create: async (data: LeaveBalanceCreate): Promise<LeaveBalance> => {
    const response = await apiClient.post<LeaveBalance>(API_ENDPOINTS.LEAVE_BALANCES, data);
    return response.data;
  },

  initForYear: async (year: number): Promise<{ message: string, count: number }> => {
    const response = await apiClient.post<{ message: string, count: number }>(`${API_ENDPOINTS.LEAVE_BALANCES_INIT}?year=${year}`);
    return response.data;
  },

  update: async (id: string, data: LeaveBalanceUpdate): Promise<LeaveBalance> => {
    const response = await apiClient.put<LeaveBalance>(API_ENDPOINTS.LEAVE_BALANCE(id), data);
    return response.data;
  },

  delete: async (id: string): Promise<any> => {
    const response = await apiClient.delete(API_ENDPOINTS.LEAVE_BALANCE(id));
    return response.data;
  },
};
