import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserInfo } from '@/types/auth';
import { authService } from '@/services/authService';
import { ROUTES, STORAGE_KEYS } from '@/utils/constants';
import { getAccessToken, setAccessToken, setRefreshToken, getRefreshToken } from './tokenManager';

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string, remember_me?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (username: string, password: string, remember_me: boolean = false) => {
        const tokens = await authService.login({ username, password, remember_me });
        setAccessToken(tokens.access_token);
        setRefreshToken(tokens.refresh_token);
        try {
          const user = await authService.getMe();
          set({ user, isAuthenticated: true });
        } catch {
          setAccessToken(null);
          setRefreshToken(null);
          set({ user: null, isAuthenticated: false });
          throw new Error('Không thể tải thông tin người dùng');
        }
      },

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
        window.location.href = ROUTES.LOGIN;
      },

      loadUser: async () => {
        const current = useAuthStore.getState();
        if (current.isLoading) return;
        const accessToken = getAccessToken();
        const refreshToken = getRefreshToken();
        if (!accessToken && !refreshToken) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({ isLoading: true });
        try {
          if (!accessToken && refreshToken) {
            try {
              const tokens = await authService.refresh(refreshToken);
              setAccessToken(tokens.access_token);
              setRefreshToken(tokens.refresh_token);
            } catch {
              setAccessToken(null);
              setRefreshToken(null);
              localStorage.removeItem(STORAGE_KEYS.AUTH_STORAGE);
              set({ user: null, isAuthenticated: false, isLoading: false });
              return;
            }
          }
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
