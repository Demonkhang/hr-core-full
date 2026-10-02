import apiClient from './apiClient';
import type { SalaryHistory, SalaryHistoryCreate, BaseSalaryConfig, BaseSalaryConfigCreate, Qualification, QualificationCreate } from '@/types/employeeProcess';
import { API_ENDPOINTS } from '@/utils/constants';

export const employeeProcessService = {
  // Salary History
  async getSalaryHistory(empId: string): Promise<SalaryHistory[]> {
    const res = await apiClient.get(API_ENDPOINTS.EMPLOYEE_SALARY_HISTORY(empId));
    return res.data;
  },

  async createSalaryHistory(empId: string, data: SalaryHistoryCreate): Promise<SalaryHistory> {
    const res = await apiClient.post(API_ENDPOINTS.EMPLOYEE_SALARY_HISTORY(empId), data);
    return res.data;
  },

  async updateSalaryHistory(empId: string, recordId: string, data: Partial<SalaryHistoryCreate>): Promise<SalaryHistory> {
    const res = await apiClient.put(API_ENDPOINTS.EMPLOYEE_SALARY_HISTORY_ITEM(empId, recordId), data);
    return res.data;
  },

  async deleteSalaryHistory(empId: string, recordId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.EMPLOYEE_SALARY_HISTORY_ITEM(empId, recordId));
  },

  // Qualifications
  async getQualifications(empId: string): Promise<Qualification[]> {
    const res = await apiClient.get(API_ENDPOINTS.EMPLOYEE_QUALIFICATIONS(empId));
    return res.data;
  },

  async createQualification(empId: string, data: QualificationCreate): Promise<Qualification> {
    const res = await apiClient.post(API_ENDPOINTS.EMPLOYEE_QUALIFICATIONS(empId), data);
    return res.data;
  },

  async updateQualification(empId: string, recordId: string, data: Partial<QualificationCreate>): Promise<Qualification> {
    const res = await apiClient.put(API_ENDPOINTS.EMPLOYEE_QUALIFICATION_ITEM(empId, recordId), data);
    return res.data;
  },

  async deleteQualification(empId: string, recordId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.EMPLOYEE_QUALIFICATION_ITEM(empId, recordId));
  },

  // Base Salary Config
  async getBaseSalaryConfigs(): Promise<BaseSalaryConfig[]> {
    const res = await apiClient.get(API_ENDPOINTS.BASE_SALARY_CONFIG);
    return res.data;
  },

  async createBaseSalaryConfig(data: BaseSalaryConfigCreate): Promise<BaseSalaryConfig> {
    const res = await apiClient.post(API_ENDPOINTS.BASE_SALARY_CONFIG, data);
    return res.data;
  },

  async updateBaseSalaryConfig(id: string, data: Partial<BaseSalaryConfigCreate & { is_active: boolean }>): Promise<BaseSalaryConfig> {
    const res = await apiClient.put(API_ENDPOINTS.BASE_SALARY_CONFIG_ITEM(id), data);
    return res.data;
  },

  async deleteBaseSalaryConfig(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.BASE_SALARY_CONFIG_ITEM(id));
  },
};
