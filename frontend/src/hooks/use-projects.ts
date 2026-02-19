"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Project, PaginatedResponse } from "@/types";

// Backend filters by role automatically based on the JWT
export function useProjects(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["projects", page, limit],
    queryFn: async (): Promise<PaginatedResponse<Project>> => {
      const res = await api.get(`/projects?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}
