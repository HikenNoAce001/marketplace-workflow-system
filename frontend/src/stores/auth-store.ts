import { create } from "zustand";
import type { User } from "@/types";

/**
 * Auth store — manages authentication state in memory.
 *
 * WHY ZUSTAND?
 * - The access token MUST live in JS memory only (never localStorage)
 * - Zustand gives us a simple global store that any component can read
 * - When the tab closes, the token disappears (security requirement)
 * - On next visit, the httpOnly refresh cookie gets a new access token
 *
 * WHAT'S STORED:
 * - accessToken: JWT string, used in Authorization header for every API call
 * - user: the current user's profile (fetched from GET /api/auth/me)
 * - isAuthenticated: derived from whether we have a token + user
 * - isLoading: true while we're checking auth status on app load
 */

interface AuthState {
  // State
  accessToken: string | null;
  user: User | null;
  isLoading: boolean;

  // Actions
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  getToken: () => string | null;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state — no token, no user, loading until we check
  accessToken: null,
  user: null,
  isLoading: true,

  /**
   * Store a new access token in memory.
   * Called after login or token refresh.
   */
  setToken: (token: string) => {
    // Set a non-httpOnly cookie so the proxy can detect active sessions.
    // The refresh_token cookie lives on the backend domain (cross-origin),
    // so the frontend proxy can't see it. This simple flag solves that.
    if (typeof document !== "undefined") {
      document.cookie = "has_session=1; path=/; max-age=604800; SameSite=Lax";
    }
    set({ accessToken: token });
  },

  /**
   * Store the current user's profile.
   * Called after GET /api/auth/me succeeds.
   */
  setUser: (user: User) => set({ user }),

  /**
   * Get the current token — used by the fetch wrapper
   * to attach Authorization: Bearer <token> to every request.
   */
  getToken: () => get().accessToken,

  /**
   * Clear all auth state — called on logout or when refresh fails.
   * After this, the user is redirected to /auth/login.
   */
  logout: () => {
    // Clear the session hint cookie so the proxy redirects to login
    if (typeof document !== "undefined") {
      document.cookie = "has_session=; path=/; max-age=0";
    }
    set({ accessToken: null, user: null, isLoading: false });
  },

  /**
   * Toggle loading state — true while checking if user has a valid session.
   * During loading, we show a spinner instead of the login page.
   */
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
