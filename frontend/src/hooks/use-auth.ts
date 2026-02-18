"use client";

/**
 * useAuth — Custom hook for all authentication operations.
 *
 * This is the SINGLE SOURCE OF TRUTH for auth logic in the frontend.
 * Any component that needs to login, logout, or check who's logged in
 * uses this hook. No auth logic should exist anywhere else.
 *
 * WHAT IT PROVIDES:
 * - devLogin(email)  → Login with a test user (dev only)
 * - logout()         → Clear session + redirect to login
 * - checkSession()   → Try to restore session from refresh cookie
 * - user             → Current user object (or null)
 * - isLoading        → True while checking session
 * - isAuthenticated  → True if we have a user
 *
 * HOW IT WORKS WITH THE BACKEND:
 * 1. devLogin calls POST /api/auth/dev-login → gets access_token + refresh cookie
 * 2. checkSession calls POST /api/auth/refresh → gets new access_token from cookie
 * 3. Both then call GET /api/auth/me → gets user profile
 * 4. logout calls POST /api/auth/logout → revokes token + clears cookie
 *
 * WHERE TOKENS LIVE:
 * - Access token: Zustand store (JS memory only — gone when tab closes)
 * - Refresh token: httpOnly cookie (browser manages it, JS can't read it)
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api-client";
import { Role } from "@/types";
import type { User, AuthTokenResponse } from "@/types";

export function useAuth() {
  const router = useRouter();

  // Pull state + actions from Zustand store
  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const logoutStore = useAuthStore((state) => state.logout);

  /**
   * Fetch the current user's profile using the access token.
   *
   * Called after login or session restore. The access token is already
   * in Zustand, so api.get() attaches it automatically via the fetch wrapper.
   *
   * GET /api/auth/me → { id, email, name, role, ... }
   */
  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const res = await api.get("/auth/me");
      if (!res.ok) return null;

      const data = await res.json();
      // Backend returns UserRead directly (not wrapped in { data: ... })
      // because auth endpoints use their own schema, not the standard wrapper
      const userData = data as User;
      setUser(userData);
      return userData;
    } catch {
      return null;
    }
  }, [setUser]);

  /**
   * DEV LOGIN — Login with a test user by email.
   *
   * This bypasses OAuth for local development. In production, this
   * endpoint would be removed from the backend.
   *
   * Flow:
   * 1. POST /api/auth/dev-login { email } → { access_token }
   *    (backend also sets httpOnly refresh cookie automatically)
   * 2. Store access_token in Zustand (memory)
   * 3. GET /api/auth/me → store user profile
   * 4. Redirect to /dashboard
   */
  const devLogin = useCallback(
    async (email: string) => {
      setLoading(true);
      try {
        // Step 1: Call dev-login endpoint
        const res = await api.post("/auth/dev-login", { email });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.detail || "Login failed");
        }

        // Step 2: Store the access token in memory (Zustand)
        const data = (await res.json()) as AuthTokenResponse;
        setToken(data.access_token);

        // Step 3: Fetch user profile with the new token
        const userData = await fetchUser();

        if (userData) {
          // Step 4: Redirect based on role
          // Each role has its own section of the app
          redirectByRole(userData.role);
        }
      } finally {
        setLoading(false);
      }
    },
    [setToken, setLoading, fetchUser]
  );

  /**
   * CHECK SESSION — Try to restore an existing session.
   *
   * Called on app load by AuthProvider. If the user had a previous session,
   * the browser still has the httpOnly refresh cookie. We use it to get
   * a fresh access token without the user needing to login again.
   *
   * Flow:
   * 1. POST /api/auth/refresh (browser sends cookie automatically)
   * 2. If 200 → got new access_token → store it → fetch user profile
   * 3. If 401 → no valid session → user needs to login
   */
  const checkSession = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      // Try to refresh — the httpOnly cookie is sent automatically
      // because our fetch wrapper uses credentials: "include"
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include", // This sends the httpOnly cookie
      });

      if (!res.ok) {
        // No valid refresh token — user needs to login
        logoutStore();
        return false;
      }

      // Got a new access token — store it
      const data = (await res.json()) as AuthTokenResponse;
      setToken(data.access_token);

      // Fetch user profile with the new token
      const userData = await fetchUser();
      return userData !== null;
    } catch {
      logoutStore();
      return false;
    } finally {
      setLoading(false);
    }
  }, [setToken, setLoading, logoutStore, fetchUser]);

  /**
   * LOGOUT — Clear everything and redirect to login.
   *
   * Flow:
   * 1. POST /api/auth/logout → backend revokes refresh token + clears cookie
   * 2. Clear Zustand store (access token + user gone from memory)
   * 3. Redirect to /auth/login
   */
  const logout = useCallback(async () => {
    try {
      // Tell backend to revoke the refresh token
      await api.post("/auth/logout");
    } catch {
      // Even if the API call fails, we still clear local state
      // (e.g., if backend is down, user can still "logout" locally)
    }

    // Clear memory state (access token + user)
    logoutStore();

    // Send user back to login page
    router.push("/auth/login");
  }, [logoutStore, router]);

  /**
   * Redirect user to the appropriate dashboard based on their role.
   *
   * Each role has different pages:
   * - ADMIN → /admin/users (manage user roles)
   * - BUYER → /buyer/projects (view/create projects)
   * - SOLVER → /solver/projects (browse available projects)
   *
   * NOTE: Routes are added as role-specific pages are built.
   * Buyer and Solver still go to /dashboard until their pages exist.
   */
  const redirectByRole = (role: string) => {
    switch (role) {
      case Role.ADMIN:
        router.push("/admin/users");
        break;
      case Role.BUYER:
        router.push("/buyer/projects");
        break;
      case Role.SOLVER:
        router.push("/solver/projects");
        break;
      default:
        router.push("/dashboard");
    }
  };

  return {
    // State
    user,
    isLoading,
    isAuthenticated: !!user,

    // Actions
    devLogin,
    logout,
    checkSession,
    redirectByRole,
  };
}
