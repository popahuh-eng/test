// ============================================================
// Auth Store — Zustand
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserProfile {
  id: string;
  email: string;
  timezone?: string;
}

interface AuthState {
  token: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (accessToken: string, refreshToken: string, user: UserProfile) => void;
  setAuth: (token: string, refreshToken: string, user: UserProfile) => void;
  logout: () => void;
  clearAuth: () => void;
  setUser: (user: UserProfile) => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: (accessToken, refreshToken, user) =>
        set({
          token: accessToken,
          accessToken,
          refreshToken,
          user,
          isAuthenticated: true,
        }),

      setAuth: (token, refreshToken, user) =>
        set({
          token,
          accessToken: token,
          refreshToken,
          user,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          token: null,
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),

      clearAuth: () =>
        set({
          token: null,
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),

      setUser: (user) => set({ user }),

      setAccessToken: (token) => set({ token, accessToken: token }),
    }),
    {
      name: 'trading-auth',
      partialize: (state) => ({
        token: state.token,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
