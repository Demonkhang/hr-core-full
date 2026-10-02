import apiClient from './apiClient';
import type { Employee, EmployeeCreate } from '@/types/employee';
import { API_ENDPOINTS } from '@/utils/constants';

export const employeeService = {
  /** GET /employees – danh sách nhân viên (có bộ lọc) */
  async list(params?: Record<string, any>): Promise<Employee[]> {
    const res = await apiClient.get(API_ENDPOINTS.EMPLOYEES, { params });
    return res.data;
  },

  /** GET /employees/:id – chi tiết 1 nhân viên */
  async get(id: string): Promise<Employee> {
    const res = await apiClient.get(API_ENDPOINTS.EMPLOYEE(id));
    return res.data;
  },

  /** POST /employees – tạo nhân viên mới */
  async create(data: EmployeeCreate): Promise<Employee> {
    const res = await apiClient.post(API_ENDPOINTS.EMPLOYEES, data);
    return res.data;
  },

  /** PUT /employees/:id – cập nhật thông tin nhân viên */
  async update(id: string, data: Partial<EmployeeCreate>): Promise<Employee> {
    const res = await apiClient.put(API_ENDPOINTS.EMPLOYEE(id), data);
    return res.data;
  },

  /** POST /employees/:id/create-account – tạo tài khoản đăng nhập cho nhân viên */
  async createAccount(id: string, password?: string): Promise<{ username: string; password?: string }> {
    const res = await apiClient.post(API_ENDPOINTS.EMPLOYEE_CREATE_ACCOUNT(id), { password });
    return res.data;
  },

  /** POST /employees/:id/reset-password – reset mật khẩu của nhân viên */
  async resetPassword(id: string, new_password?: string): Promise<{ username: string; new_password?: string }> {
    const res = await apiClient.post(API_ENDPOINTS.EMPLOYEE_RESET_PASSWORD(id), { new_password });
    return res.data;
  },

  /** DELETE /employees/:id – vô hiệu hoá nhân viên (xóa mềm) */
  async deactivate(id: string, status: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.EMPLOYEE(id), { data: { status } });
  },

  /** PATCH /employees/:id/restore – khôi phục nhân viên đã nghỉ */
  async restore(id: string): Promise<void> {
    await apiClient.patch(API_ENDPOINTS.EMPLOYEE_RESTORE(id));
  },
};
