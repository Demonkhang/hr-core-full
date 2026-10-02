import apiClient from './apiClient';
import type { UserInfo } from '@/types/auth';
import { API_ENDPOINTS } from '@/utils/constants';

export interface UserListItem {
  id: string;
  username: string;
  email: string;
  full_name: string;
  is_super_admin: boolean;
  employee_id: string | null;
  department_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
}

export interface UserUpdateData {
  email?: string;
  full_name?: string;
  is_super_admin?: boolean;
  is_active?: boolean;
  password?: string;
}

export const userService = {
  /** GET /users – danh sách người dùng hệ thống */
  async list(): Promise<UserListItem[]> {
    const res = await apiClient.get(API_ENDPOINTS.USERS);
    return res.data;
  },

  /** GET /users/:id – chi tiết 1 người dùng */
  async get(id: string): Promise<UserListItem> {
    const res = await apiClient.get(API_ENDPOINTS.USER(id));
    return res.data;
  },

  /** PUT /users/:id – cập nhật thông tin người dùng */
  async update(id: string, data: UserUpdateData): Promise<UserListItem> {
    const res = await apiClient.put(API_ENDPOINTS.USER(id), data);
    return res.data;
  },

  /** POST /users/:id/reset-password – reset mật khẩu người dùng */
  async resetPassword(id: string, newPassword: string): Promise<void> {
    await apiClient.post(`${API_ENDPOINTS.USER(id)}/reset-password`, { new_password: newPassword });
  },
};
