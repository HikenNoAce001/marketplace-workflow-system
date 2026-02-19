"use client";

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

// Submission history, newest first
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

export function useMyRequests(page: number = 1) {
  return useQuery({
    queryKey: ["my-requests", page],
    queryFn: async (): Promise<PaginatedResponse<ProjectRequest>> => {
      const res = await api.get(`/requests/me?page=${page}&limit=20`);
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

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

// Mutations

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
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

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
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
  });
}

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

// Uses XHR for upload progress tracking
export function useUploadSubmission(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

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

      setUploadProgress(0);

      const res = await api.uploadWithProgress(
        `/tasks/${taskId}/submissions`,
        formData,
        (percent) => setUploadProgress(percent),
      );

      if (!res.ok) {
        const error = await res.json();
        // Handle both string and array error formats from FastAPI
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
      queryClient.invalidateQueries({ queryKey: ["task-submissions", taskId] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setUploadProgress(0);
    },
    onError: () => {
      setUploadProgress(0);
    },
  });

  return { ...mutation, uploadProgress, resetProgress };
}

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
