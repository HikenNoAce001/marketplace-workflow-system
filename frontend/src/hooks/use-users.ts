"use client";

/**
 * useUsers — TanStack Query hooks for user endpoints.
 *
 * WHY TANSTACK QUERY?
 * Instead of manually managing loading/error/data states with useState,
 * TanStack Query does it automatically. It also provides:
 * - Automatic caching (don't refetch data we already have)
 * - Background refetching (keeps data fresh without loading spinners)
 * - Mutations with cache invalidation (update role → refetch user list)
 * - Retry on failure (built-in, configurable)
 *
 * HOOKS PROVIDED:
 * - useUsers(page, limit) → paginated user list (ADMIN only)
 * - useUpdateRole()       → mutation to change a user's role
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { User, PaginatedResponse, UserRole } from "@/types";

/**
 * Fetch paginated user list from GET /api/users.
 *
 * The query key includes page + limit so TanStack Query caches
 * each page separately. Navigating back to page 1 shows cached
 * data instantly while refetching in the background.
 */
export function useUsers(page: number = 1, limit: number = 20) {
  return useQuery({
    // Query key — TanStack Query uses this to cache and deduplicate
    // ["users", 1, 20] is a different cache entry from ["users", 2, 20]
    queryKey: ["users", page, limit],

    // Query function — the actual API call
    queryFn: async (): Promise<PaginatedResponse<User>> => {
      const res = await api.get(`/users?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },

    // Poll every 15s — admin user list changes infrequently
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Mutation to change a user's role via PATCH /api/users/{id}/role.
 *
 * WHY useMutation (not useQuery)?
 * - useQuery = reading data (GET requests)
 * - useMutation = changing data (POST/PATCH/DELETE requests)
 *
 * After a successful role change, we invalidate the "users" cache
 * so the table refetches and shows the updated role immediately.
 */
export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function — called when mutate() is invoked
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await api.patch(`/users/${userId}/role`, { role });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to update role");
      }
      return res.json() as Promise<User>;
    },

    // On success — invalidate all cached user queries so the list refreshes
    // This triggers a background refetch of the current page
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
