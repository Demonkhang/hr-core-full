import { STORAGE_KEYS } from '@/utils/constants';

let inMemoryAccessToken: string | null = null;

/** Lấy access token đang lưu trong memory (hoặc fallback từ localStorage khi SSO) */
export function getAccessToken(): string | null {
  return inMemoryAccessToken || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

/** Lưu access token vào memory và đồng bộ localStorage để hỗ trợ SSO giữa 5173 & 5174 */
export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
  if (token) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  }
}

/** Lấy refresh token từ localStorage */
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/** Lưu/xoá refresh token trong localStorage */
export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }
}
