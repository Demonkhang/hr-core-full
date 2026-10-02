import axios from 'axios';
import { message } from 'antd';
import { API_ENDPOINTS, STORAGE_KEYS, ROUTES, ERROR_MESSAGES } from '@/utils/constants';
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken } from '@/store/tokenManager';

let refreshPromise: Promise<void> | null = null;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  paramsSerializer: (params) => {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
        }
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    }
    return parts.join('&');
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.config?.url?.includes('auth/refresh')) {
      return Promise.reject(error);
    }
    if (error.response?.status === 403) {
      message.error(ERROR_MESSAGES.FORBIDDEN);
    }
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = getRefreshToken();
      if (!refreshToken) return Promise.reject(error);

      if (!refreshPromise) {
        refreshPromise = (async () => {
          const { data } = await axios.post(
            API_ENDPOINTS.HR_AUTH_REFRESH,
            { refresh_token: refreshToken },
            { timeout: 15000 }
          );
          setAccessToken(data.access_token);
          setRefreshToken(data.refresh_token);
        })();
      }
      try {
        await refreshPromise;
        setTimeout(() => { refreshPromise = null; }, 1000);
        error.config.headers.Authorization = `Bearer ${getAccessToken()}`;
        return apiClient(error.config);
      } catch (err) {
        setTimeout(() => { refreshPromise = null; }, 1000);
        setAccessToken(null);
        setRefreshToken(null);
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
