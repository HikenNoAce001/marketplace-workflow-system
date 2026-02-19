import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;

  setToken: (token: string) => void;
  setUser: (user: User) => void;
  getToken: () => string | null;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isLoading: true,

  setToken: (token: string) => {
    // Set a session hint cookie so the proxy can detect active sessions
    // (the refresh_token cookie is cross-origin and invisible to the proxy)
    if (typeof document !== "undefined") {
      document.cookie = "has_session=1; path=/; max-age=604800; SameSite=Lax";
    }
    set({ accessToken: token });
  },

  setUser: (user: User) => set({ user }),

  getToken: () => get().accessToken,

  logout: () => {
    if (typeof document !== "undefined") {
      document.cookie = "has_session=; path=/; max-age=0";
    }
    set({ accessToken: null, user: null, isLoading: false });
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
