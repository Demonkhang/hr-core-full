import { STORAGE_KEYS } from '@/utils/constants';

let inMemoryAccessToken: string | null = null;

/** Lấy access token đang lưu trong memory */
export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

/** Lưu access token vào memory */
export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
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
