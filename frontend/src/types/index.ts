// Enums — must match backend Python enums

export const Role = {
  ADMIN: "ADMIN",
  BUYER: "BUYER",
  SOLVER: "SOLVER",
} as const;

export const ProjectState = {
  OPEN: "OPEN",
  ASSIGNED: "ASSIGNED",
  COMPLETED: "COMPLETED",
} as const;

export const TaskState = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  COMPLETED: "COMPLETED",
  REVISION_REQUESTED: "REVISION_REQUESTED",
} as const;

export const RequestState = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;

export const SubmissionState = {
  PENDING_REVIEW: "PENDING_REVIEW",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
} as const;

export type UserRole = (typeof Role)[keyof typeof Role];
export type ProjectStatus = (typeof ProjectState)[keyof typeof ProjectState];
export type TaskStatus = (typeof TaskState)[keyof typeof TaskState];
export type RequestStatus = (typeof RequestState)[keyof typeof RequestState];
export type SubmissionStatus = (typeof SubmissionState)[keyof typeof SubmissionState];

// Models — match backend response schemas

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  skills: string[];
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  deadline: string | null;
  status: ProjectStatus;
  buyer_id: string;
  assigned_solver_id: string | null;
  created_at: string;
  updated_at: string;
  buyer_name: string;
  assigned_solver_name: string | null;
}

export interface ProjectRequest {
  id: string;
  project_id: string;
  solver_id: string;
  cover_letter: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  solver_name: string;
}

export interface Task {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string;
  deadline: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  notes: string | null;
  status: SubmissionStatus;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

// API response wrappers

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleResponse<T> {
  data: T;
}

export interface ErrorResponse {
  detail: string;
}

// Request payloads

export interface CreateProjectPayload {
  title: string;
  description: string;
  budget?: number | null;
  deadline?: string | null;
}

export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  budget?: number | null;
  deadline?: string | null;
}

export interface CreateRequestPayload {
  cover_letter: string;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  deadline?: string | null;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  deadline?: string | null;
}

export interface RejectSubmissionPayload {
  reviewer_notes: string;
}

export interface UpdateProfilePayload {
  bio?: string | null;
  skills?: string[];
}

export interface UpdateRolePayload {
  role: UserRole;
}

// Auth types

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

export interface DevLoginPayload {
  email: string;
}
