"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { User, PaginatedResponse, UserRole } from "@/types";

export function useUsers(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["users", page, limit],
    queryFn: async (): Promise<PaginatedResponse<User>> => {
      const res = await api.get(`/users?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await api.patch(`/users/${userId}/role`, { role });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to update role");
      }
      return res.json() as Promise<User>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
