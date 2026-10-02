import axios from 'axios';
import { API_ENDPOINTS } from '@/utils/constants';
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken } from '@/store/tokenManager';
import type { LoginRequest, TokenResponse, UserInfo } from '@/types/auth';

const hrClient = axios.create({
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

hrClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

hrClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url: string = error.config?.url || '';
    if (url.includes('auth/refresh')) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = getRefreshToken();
      if (!refreshToken) return Promise.reject(error);
      try {
        const { data } = await axios.post(API_ENDPOINTS.HR_AUTH_REFRESH, { refresh_token: refreshToken });
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        error.config.headers.Authorization = `Bearer ${data.access_token}`;
        return hrClient(error.config);
      } catch {
        setAccessToken(null);
        setRefreshToken(null);
        localStorage.removeItem('mbs-auth-storage');
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export { hrClient };
export const authService = {
  async login(data: LoginRequest): Promise<TokenResponse> {
    const res = await hrClient.post(API_ENDPOINTS.HR_AUTH_LOGIN, data);
    return res.data;
  },

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const res = await hrClient.post(API_ENDPOINTS.HR_AUTH_REFRESH, { refresh_token: refreshToken });
    return res.data;
  },

  async logout(): Promise<void> {
    await hrClient.post(API_ENDPOINTS.HR_AUTH_LOGOUT);
  },

  async getMe(): Promise<UserInfo> {
    const res = await hrClient.get(API_ENDPOINTS.HR_AUTH_ME);
    return res.data;
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await hrClient.post(API_ENDPOINTS.HR_AUTH_CHANGE_PASSWORD, { old_password: oldPassword, new_password: newPassword });
  },
};
