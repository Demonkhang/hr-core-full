import { STORAGE_KEYS } from '@/utils/constants';

let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

export function setRefreshToken(token: string | null) {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }
}

export function getAuthStorageToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH_STORAGE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.user ? parsed.state.user.id : null;
  } catch {
    return null;
  }
}
