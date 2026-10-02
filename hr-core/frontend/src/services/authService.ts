import apiClient from './apiClient';
import type { LoginRequest, TokenResponse, UserInfo } from '@/types/auth';
import { API_ENDPOINTS } from '@/utils/constants';

export const authService = {
  /** POST /auth/login – đăng nhập, trả về access + refresh token */
  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await apiClient.post(API_ENDPOINTS.AUTH.LOGIN, data);
    return res.data;
  },

  /** POST /auth/refresh – refresh token, trả về cặp token mới */
  async refresh(refreshToken: string): Promise<TokenResponse> {
    const res = await apiClient.post(API_ENDPOINTS.AUTH.REFRESH, { refresh_token: refreshToken });
    return res.data;
  },

  /** POST /auth/logout – đăng xuất */
  async logout(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  },

  /** GET /auth/me – lấy thông tin user hiện tại */
  async getMe(): Promise<UserInfo> {
    const res = await apiClient.get(API_ENDPOINTS.AUTH.ME);
    return res.data;
  },

  /** POST /auth/change-password – đổi mật khẩu */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, { old_password: oldPassword, new_password: newPassword });
  },
};
