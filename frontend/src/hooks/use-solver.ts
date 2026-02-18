"use client";

/**
 * use-solver.ts — TanStack Query hooks for ALL solver operations.
 *
 * QUERIES (fetching data):
 * - useProject(id)              → Single project detail
 * - useProjectTasks(id)         → Tasks within an assigned project
 * - useTaskSubmissions(taskId)  → ZIP submissions for a task
 * - useMyRequests(page)         → Solver's own bids across all projects
 * - useMyProfile()              → Solver's profile (bio + skills)
 *
 * MUTATIONS (changing data):
 * - useCreateRequest(projectId) → POST bid on a project
 * - useCreateTask(projectId)    → POST new task on assigned project
 * - useUpdateTask(projectId)    → PATCH task metadata (title, desc, deadline)
 * - useUploadSubmission(projectId, taskId) → Upload ZIP file
 * - useUpdateProfile()          → PATCH bio + skills
 *
 * WHY SEPARATE FROM use-buyer.ts?
 * Solvers and buyers have different operations and different cache invalidation
 * patterns. Keeping them separate makes each file focused and easy to reason about.
 * Some query keys overlap (project, project-tasks, task-submissions) — that's fine,
 * TanStack Query deduplicates them if both roles happen to fetch the same data.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectRequest,
  Task,
  Submission,
  User,
  PaginatedResponse,
  CreateRequestPayload,
  CreateTaskPayload,
  UpdateTaskPayload,
  UpdateProfilePayload,
} from "@/types";

// ============================================================
// QUERIES — fetching data
// ============================================================

/**
 * Fetch a single project by ID.
 * Solver can see OPEN projects (to browse/bid) and projects assigned to them.
 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<Project> => {
      const res = await api.get(`/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch tasks for a project the solver is assigned to.
 * The backend checks that the solver is either assigned or an admin.
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
  });
}

/**
 * Fetch submissions for a specific task.
 * Shows the solver their submission history (newest first).
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
  });
}

/**
 * Fetch the solver's own bids across all projects.
 * GET /api/requests/me → shows status of each bid (PENDING, ACCEPTED, REJECTED).
 */
export function useMyRequests(page: number = 1) {
  return useQuery({
    queryKey: ["my-requests", page],
    queryFn: async (): Promise<PaginatedResponse<ProjectRequest>> => {
      const res = await api.get(`/requests/me?page=${page}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });
}

/**
 * Fetch the solver's own profile (bio + skills).
 * GET /api/users/me/profile → UserRead with bio, skills, etc.
 */
export function useMyProfile() {
  return useQuery({
    queryKey: ["my-profile"],
    queryFn: async (): Promise<User> => {
      const res = await api.get("/users/me/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
  });
}

// ============================================================
// MUTATIONS — changing data
// ============================================================

/**
 * Submit a bid (request) on a project.
 * POST /api/projects/{id}/requests { cover_letter }
 * Only works on OPEN projects. One bid per solver per project.
 */
export function useCreateRequest(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateRequestPayload): Promise<ProjectRequest> => {
      const res = await api.post(
        `/projects/${projectId}/requests`,
        payload
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      // Refresh the requests list and project detail (to reflect new bid)
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

/**
 * Create a task on an assigned project.
 * POST /api/projects/{id}/tasks { title, description, deadline? }
 * Only the assigned solver can create tasks. Project must be ASSIGNED.
 */
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTaskPayload): Promise<Task> => {
      const res = await api.post(
        `/projects/${projectId}/tasks`,
        payload
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to create task");
      }
      return res.json();
    },
    onSuccess: () => {
      // Refresh the task list to show the new task
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}

/**
 * Update task metadata (title, description, deadline).
 * PATCH /api/tasks/{id} { title?, description?, deadline? }
 * Only the assigned solver can update. Cannot update COMPLETED tasks.
 */
export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: UpdateTaskPayload;
    }): Promise<Task> => {
      const res = await api.patch(`/tasks/${taskId}`, payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to update task");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}

/**
 * Upload a ZIP submission for a task — WITH upload progress tracking.
 * POST /api/tasks/{id}/submissions (multipart/form-data)
 *
 * Uses api.uploadWithProgress() (XMLHttpRequest) instead of api.upload() (fetch)
 * to get granular progress events. This lets the UI show a real progress bar
 * instead of just a spinner — important for large ZIP files (up to 50MB).
 *
 * RETURNS:
 * - mutation: the standard TanStack mutation object (mutateAsync, isPending, etc.)
 * - uploadProgress: number 0–100 showing upload percentage
 * - resetProgress: function to reset progress back to 0
 *
 * CASCADE: creates submission (PENDING_REVIEW) + task → SUBMITTED
 */
export function useUploadSubmission(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  // Track upload progress as a percentage (0–100)
  const [uploadProgress, setUploadProgress] = useState(0);

  // Reset progress — called after upload completes or is cancelled
  const resetProgress = useCallback(() => setUploadProgress(0), []);

  const mutation = useMutation({
    mutationFn: async ({
      file,
      notes,
    }: {
      file: File;
      notes?: string;
    }): Promise<Submission> => {
      const formData = new FormData();
      formData.append("file", file);
      if (notes) formData.append("notes", notes);

      // Reset progress at the start of each upload
      setUploadProgress(0);

      // Use XMLHttpRequest-based upload for progress events
      const res = await api.uploadWithProgress(
        `/tasks/${taskId}/submissions`,
        formData,
        (percent) => setUploadProgress(percent),
      );

      if (!res.ok) {
        const error = await res.json();
        // FastAPI returns { detail: "string" } for 400 errors, but
        // { detail: [{msg: "..."}] } for 422 validation errors.
        // Handle both formats gracefully.
        const detail = error.detail;
        const message =
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg: string }) => d.msg).join(", ")
              : "Failed to upload submission";
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      // Task status changed to SUBMITTED, new submission added
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      // Reset progress after successful upload
      setUploadProgress(0);
    },
    onError: () => {
      // Reset progress on failure so the bar disappears
      setUploadProgress(0);
    },
  });

  return { ...mutation, uploadProgress, resetProgress };
}

/**
 * Update solver's own profile (bio + skills).
 * PATCH /api/users/me/profile { bio?, skills? }
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateProfilePayload): Promise<User> => {
      const res = await api.patch("/users/me/profile", payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });
}
