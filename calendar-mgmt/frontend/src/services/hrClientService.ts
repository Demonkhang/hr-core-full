import { hrClient } from './authService';
import type { Employee } from '@/types/employee';
import type { Department } from '@/types/department';
import type { Workplace } from '@/types/workplace';
import type { UserInfo } from '@/types/auth';
import { API_ENDPOINTS } from '@/utils/constants';

export const hrClientService = {
  async getCurrentUser(): Promise<UserInfo> {
    const res = await hrClient.get(API_ENDPOINTS.HR_AUTH_ME);
    return res.data;
  },

  async getEmployee(id: string): Promise<Employee> {
    const res = await hrClient.get(API_ENDPOINTS.HR_EMPLOYEE(id));
    return res.data;
  },

  async getEmployees(params?: Record<string, any>): Promise<Employee[]> {
    const res = await hrClient.get(API_ENDPOINTS.HR_EMPLOYEES, { params });
    return res.data;
  },

  async getEmployeesBatch(ids: string[]): Promise<Employee[]> {
    const res = await hrClient.get(API_ENDPOINTS.HR_EMPLOYEES, { params: { id: ids } });
    return res.data;
  },

  async getDepartment(id: string): Promise<Department> {
    const res = await hrClient.get(API_ENDPOINTS.HR_DEPARTMENT(id));
    return res.data;
  },

  async getDepartments(params?: Record<string, any>): Promise<Department[]> {
    const res = await hrClient.get(API_ENDPOINTS.HR_DEPARTMENTS, { params });
    return res.data;
  },

  async getWorkplace(id: string): Promise<Workplace> {
    const res = await hrClient.get(API_ENDPOINTS.HR_WORKPLACE(id));
    return res.data;
  },

  async getWorkplaces(params?: Record<string, any>): Promise<Workplace[]> {
    const res = await hrClient.get(API_ENDPOINTS.HR_WORKPLACES, { params });
    return res.data;
  },
};
