"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api-client";
import { Role } from "@/types";
import type { User, AuthTokenResponse } from "@/types";

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const user = useAuthStore((state) => state.user);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setToken = useAuthStore((state) => state.setToken);
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const logoutStore = useAuthStore((state) => state.logout);

  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const res = await api.get("/auth/me");
      if (!res.ok) return null;

      const data = await res.json();
      const userData = data as User;
      setUser(userData);
      return userData;
    } catch {
      return null;
    }
  }, [setUser]);

  const devLogin = useCallback(
    async (email: string) => {
      setLoading(true);
      try {
        // Logout first to revoke old refresh token cookie —
        // prevents stale token from a previous user session
        // causing role mismatches on auto-refresh
        await api.post("/auth/logout").catch(() => {});
        logoutStore(); // clear in-memory token so dev-login goes clean

        const res = await api.post("/auth/dev-login", { email });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.detail || "Login failed");
        }

        const data = (await res.json()) as AuthTokenResponse;
        queryClient.clear(); // clear any stale data from previous user
        setToken(data.access_token);

        const userData = await fetchUser();
        if (userData) {
          redirectByRole(userData.role);
        }
      } finally {
        setLoading(false);
      }
    },
    [setToken, setLoading, logoutStore, fetchUser, queryClient]
  );

  const checkSession = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const API_BASE =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        logoutStore();
        return false;
      }

      const data = (await res.json()) as AuthTokenResponse;
      setToken(data.access_token);

      const userData = await fetchUser();
      return userData !== null;
    } catch {
      logoutStore();
      return false;
    } finally {
      setLoading(false);
    }
  }, [setToken, setLoading, logoutStore, fetchUser]);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Clear local state even if the API call fails
    }

    queryClient.clear(); // wipe previous user's cached data
    logoutStore();
    router.push("/auth/login");
  }, [logoutStore, router, queryClient]);

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
    user,
    isLoading,
    isAuthenticated: !!user,
    devLogin,
    logout,
    checkSession,
    redirectByRole,
  };
}
