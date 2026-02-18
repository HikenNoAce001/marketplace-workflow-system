"use client";

/**
 * useProjects — TanStack Query hooks for project endpoints.
 *
 * This hook is used by ALL roles (each sees different projects):
 * - ADMIN:  all projects (read-only overview)
 * - BUYER:  own projects only (will add create/update mutations later)
 * - SOLVER: OPEN projects + assigned projects
 *
 * The backend handles the role-based filtering — we just call GET /api/projects
 * and the backend returns the right data based on who's asking.
 *
 * HOOKS PROVIDED (for now):
 * - useProjects(page, limit) → paginated project list (role-aware)
 *
 * More hooks (useCreateProject, useUpdateProject, etc.) will be added
 * when we build the Buyer and Solver pages.
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Project, PaginatedResponse } from "@/types";

/**
 * Fetch paginated project list from GET /api/projects.
 *
 * The backend automatically filters by role:
 * - ADMIN sees all projects
 * - BUYER sees only their own projects
 * - SOLVER sees OPEN + assigned projects
 *
 * We don't need to pass the role — the JWT tells the backend who we are.
 */
export function useProjects(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["projects", page, limit],

    queryFn: async (): Promise<PaginatedResponse<Project>> => {
      const res = await api.get(`/projects?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });
}
