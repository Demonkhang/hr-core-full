import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@/types/auth';
import { authService } from '@/services/authService';
import { STORAGE_KEYS } from '@/utils/constants';
import { getAccessToken, setAccessToken, setRefreshToken, getRefreshToken } from './tokenManager';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, remember_me?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

/** Zustand store: quản lý trạng thái xác thực (user, token, login/logout/loadUser) */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      /** Đăng nhập: gọi API login, lưu token, sau đó tải thông tin user */
      login: async (username: string, password: string, remember_me: boolean = false) => {
        const tokens = await authService.login({ username, password, remember_me });
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
        try {
          const user = await authService.getMe();
          set({ user, isAuthenticated: true });
        } catch (err) {
          setAccessToken(null);
          setRefreshToken(null);
          set({ user: null, isAuthenticated: false });
          throw err;
        }
      },

      /** Đăng xuất: gọi API logout, xoá token và reset state */
      logout: async () => {
        try {
          await authService.logout();
        } catch (err) {
          console.warn('Logout error:', err);
        }
        setAccessToken(null);
        setRefreshToken(null);
        localStorage.removeItem(STORAGE_KEYS.AUTH_STORAGE);
        set({ user: null, isAuthenticated: false });
      },

      /** Tải thông tin user từ token hiện có (dùng khi reload trang) */
      loadUser: async () => {
        const token = getAccessToken() || getRefreshToken();
        if (!token) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({ isLoading: true });
        try {
          const user = await authService.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          setAccessToken(null);
          setRefreshToken(null);
          localStorage.removeItem(STORAGE_KEYS.AUTH_STORAGE);
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: STORAGE_KEYS.AUTH_STORAGE,
      partialize: (state) => ({
        user: state.user,
      }),
    }
  )
);
