"use client";

/**
 * use-buyer.ts — TanStack Query hooks for ALL buyer operations.
 *
 * This file contains every query and mutation the buyer role needs:
 *
 * QUERIES (fetching data):
 * - useProject(id)              → Single project detail
 * - useProjectRequests(id)      → Solver bids on a project
 * - useProjectTasks(id)         → Tasks within a project
 * - useTaskSubmissions(taskId)  → ZIP submissions for a task
 *
 * MUTATIONS (changing data):
 * - useCreateProject()          → POST /api/projects
 * - useAcceptRequest()          → PATCH /api/requests/{id}/accept (CASCADE)
 * - useRejectRequest()          → PATCH /api/requests/{id}/reject
 * - useAcceptSubmission()       → PATCH /api/submissions/{id}/accept (CASCADE)
 * - useRejectSubmission()       → PATCH /api/submissions/{id}/reject
 *
 * UTILITY:
 * - useDownloadSubmission()     → GET presigned URL + trigger browser download
 *
 * WHY ONE FILE?
 * All buyer hooks are related — they share query key patterns and invalidation
 * logic. When you accept a request, we need to invalidate both the requests list
 * AND the project detail (status changes to ASSIGNED). Keeping them together
 * makes these cross-invalidations clear and easy to maintain.
 *
 * PATTERN:
 * - Queries use useQuery() — automatically cache, refetch on focus, etc.
 * - Mutations use useMutation() with onSuccess → invalidateQueries to refresh stale data
 * - All API calls go through our fetch wrapper (api.get/post/patch) which handles auth
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectRequest,
  Task,
  Submission,
  PaginatedResponse,
  SingleResponse,
  CreateProjectPayload,
  RejectSubmissionPayload,
} from "@/types";

// ============================================================
// QUERIES — fetching data
// ============================================================

/**
 * Fetch a single project by ID.
 *
 * Used on the project detail page to show title, description, status, etc.
 * The backend checks that the buyer owns this project (403 if not).
 *
 * NOTE: The backend returns ProjectRead directly (not wrapped in { data: ... })
 * because it uses response_model=ProjectRead on the endpoint.
 */
export function useProject(projectId: string) {
  return useQuery({
    // Include projectId in the key so each project is cached separately
    queryKey: ["project", projectId],

    queryFn: async (): Promise<Project> => {
      const res = await api.get(`/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      // Backend returns ProjectRead directly (not wrapped in { data })
      return res.json();
    },

    // Don't fetch if we don't have an ID yet (e.g., during page load)
    enabled: !!projectId,

    // Poll every 5s for real-time cross-user updates (e.g., solver creates tasks)
    refetchInterval: 5_000,
    refetchIntervalInBackground: false, // Pause polling when tab is hidden
  });
}

/**
 * Fetch solver bids (requests) for a specific project.
 *
 * Buyer sees who wants to work on their project. Each request has:
 * - solver_id (who's bidding)
 * - cover_letter (their pitch)
 * - status (PENDING / ACCEPTED / REJECTED)
 *
 * Only PENDING requests can be accepted/rejected.
 */
export function useProjectRequests(projectId: string, page: number = 1) {
  return useQuery({
    queryKey: ["project-requests", projectId, page],

    queryFn: async (): Promise<PaginatedResponse<ProjectRequest>> => {
      const res = await api.get(
        `/projects/${projectId}/requests?page=${page}&limit=20`
      );
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },

    enabled: !!projectId,

    // Poll for new bids from solvers
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Fetch tasks for a specific project.
 *
 * Tasks are created by the assigned solver. The buyer sees them to track
 * progress and review submissions. Each task has a status:
 * IN_PROGRESS → SUBMITTED → COMPLETED (with revision cycle)
 */
export function useProjectTasks(projectId: string, page: number = 1) {
  return useQuery({
    queryKey: ["project-tasks", projectId, page],

    queryFn: async (): Promise<PaginatedResponse<Task>> => {
      const res = await api.get(
        `/projects/${projectId}/tasks?page=${page}&limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch tasks");
      return res.json();
    },

    enabled: !!projectId,

    // Poll for new tasks created by solver
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

/**
 * Fetch submissions (ZIP files) for a specific task.
 *
 * A task can have multiple submissions (resubmissions after rejection).
 * Ordered by submitted_at DESC — newest first.
 * Only one can be PENDING_REVIEW at a time.
 */
export function useTaskSubmissions(taskId: string) {
  return useQuery({
    queryKey: ["task-submissions", taskId],

    queryFn: async (): Promise<PaginatedResponse<Submission>> => {
      const res = await api.get(`/tasks/${taskId}/submissions?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },

    enabled: !!taskId,

    // Poll for new submissions from solver
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

// ============================================================
// MUTATIONS — changing data
// ============================================================

/**
 * Create a new project.
 *
 * POST /api/projects → { title, description, budget?, deadline? }
 * On success, invalidates the projects list so it shows the new project.
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateProjectPayload): Promise<Project> => {
      const res = await api.post("/projects", payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to create project");
      }
      return res.json();
    },

    onSuccess: () => {
      // Invalidate the projects list so it includes the new project
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Accept a solver's request (bid) on a project.
 *
 * PATCH /api/requests/{id}/accept
 *
 * CASCADE (all happens in one backend transaction):
 * 1. This request → ACCEPTED
 * 2. All other PENDING requests for the same project → REJECTED
 * 3. Solver gets assigned to the project
 * 4. Project status → ASSIGNED
 *
 * That's why we invalidate BOTH requests and the project — everything changes.
 */
export function useAcceptRequest(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string): Promise<ProjectRequest> => {
      const res = await api.patch(`/requests/${requestId}/accept`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to accept request");
      }
      return res.json();
    },

    onSuccess: () => {
      // Invalidate both — project status changed + all requests statuses changed
      queryClient.invalidateQueries({ queryKey: ["project-requests", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Reject a single solver's request.
 *
 * PATCH /api/requests/{id}/reject
 * No cascade — just this one request changes to REJECTED.
 * Project stays OPEN, other requests stay PENDING.
 */
export function useRejectRequest(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string): Promise<ProjectRequest> => {
      const res = await api.patch(`/requests/${requestId}/reject`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to reject request");
      }
      return res.json();
    },

    onSuccess: () => {
      // Only the requests list needs refreshing
      queryClient.invalidateQueries({ queryKey: ["project-requests", projectId] });
    },
  });
}

/**
 * Accept a submission (ZIP file) for a task.
 *
 * PATCH /api/submissions/{id}/accept
 *
 * CASCADE (all in one backend transaction):
 * 1. Submission → ACCEPTED
 * 2. Task → COMPLETED
 * 3. If ALL tasks in the project are COMPLETED → Project → COMPLETED
 *
 * We invalidate everything because task, submissions, AND project can change.
 */
export function useAcceptSubmission(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string): Promise<Submission> => {
      const res = await api.patch(`/submissions/${submissionId}/accept`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to accept submission");
      }
      return res.json();
    },

    onSuccess: () => {
      // Task status changed, submissions changed, maybe project completed
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Reject a submission with reviewer notes (feedback).
 *
 * PATCH /api/submissions/{id}/reject { reviewer_notes: "..." }
 *
 * Result: submission → REJECTED, task → REVISION_REQUESTED.
 * Solver sees the feedback and can resubmit a new ZIP.
 */
export function useRejectSubmission(projectId: string, taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      submissionId,
      reviewerNotes,
    }: {
      submissionId: string;
      reviewerNotes: string;
    }): Promise<Submission> => {
      const payload: RejectSubmissionPayload = { reviewer_notes: reviewerNotes };
      const res = await api.patch(`/submissions/${submissionId}/reject`, payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to reject submission");
      }
      return res.json();
    },

    onSuccess: () => {
      // Task went to REVISION_REQUESTED, submission went to REJECTED
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}

// ============================================================
// UTILITY — download helper
// ============================================================

/**
 * Download a submission ZIP file.
 *
 * Flow:
 * 1. GET /api/submissions/{id}/download → { download_url: "https://minio..." }
 * 2. Open the presigned URL in a new tab → browser downloads the file
 *
 * WHY NOT a mutation?
 * Downloads don't change server state. But we use a plain async function
 * instead of useQuery because downloads are user-triggered (click), not
 * automatic. We don't want to cache or refetch download URLs.
 */
export async function downloadSubmission(submissionId: string): Promise<void> {
  const res = await api.get(`/submissions/${submissionId}/download`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to get download URL");
  }
  const data = (await res.json()) as { download_url: string };
  // Open the presigned MinIO URL in a new tab — browser handles the download
  window.open(data.download_url, "_blank");
}
