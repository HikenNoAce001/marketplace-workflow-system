"use client";

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

// Queries

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<Project> => {
      const res = await api.get(`/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

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
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

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
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

// Newest first, only one can be PENDING_REVIEW at a time
export function useTaskSubmissions(taskId: string) {
  return useQuery({
    queryKey: ["task-submissions", taskId],
    queryFn: async (): Promise<PaginatedResponse<Submission>> => {
      const res = await api.get(`/tasks/${taskId}/submissions?limit=50`);
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
    enabled: !!taskId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}

// Mutations

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
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// Accepting cascades: this request ACCEPTED, others REJECTED, solver assigned, project ASSIGNED
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
      queryClient.invalidateQueries({ queryKey: ["project-requests", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["project-requests", projectId] });
    },
  });
}

// Accepting cascades: submission ACCEPTED, task COMPLETED, maybe project COMPLETED
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
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// Rejection: submission REJECTED, task goes to REVISION_REQUESTED
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
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}

// Download via presigned MinIO URL
export async function downloadSubmission(submissionId: string): Promise<void> {
  const res = await api.get(`/submissions/${submissionId}/download`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to get download URL");
  }
  const data = (await res.json()) as { download_url: string };
  window.open(data.download_url, "_blank");
}
