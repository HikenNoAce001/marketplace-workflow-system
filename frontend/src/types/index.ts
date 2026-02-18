/**
 * TypeScript types that match our backend Pydantic schemas exactly.
 * These ensure the frontend and backend agree on data shapes.
 * If the backend changes a field, TypeScript will catch it here.
 */

// ============================================================
// Enums — must match backend Python enums exactly
// ============================================================

/**
 * Role & status constants — use these instead of raw string literals.
 * Avoids hardcoded values scattered across the codebase.
 * If a value ever changes, we update it in ONE place.
 */
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

/** User roles — exactly 3, no more */
export type UserRole = (typeof Role)[keyof typeof Role];

/** Project lifecycle: OPEN → ASSIGNED → COMPLETED */
export type ProjectStatus = (typeof ProjectState)[keyof typeof ProjectState];

/** Task lifecycle: IN_PROGRESS → SUBMITTED → COMPLETED (with revision cycle) */
export type TaskStatus = (typeof TaskState)[keyof typeof TaskState];

/** Request: solver asks to work on a project */
export type RequestStatus = (typeof RequestState)[keyof typeof RequestState];

/** Submission: ZIP file review status */
export type SubmissionStatus = (typeof SubmissionState)[keyof typeof SubmissionState];

// ============================================================
// Models — match backend response schemas (what the API returns)
// ============================================================

/** User as returned by GET /api/auth/me and user endpoints */
export interface User {
  id: string;          // UUID from backend
  email: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  skills: string[];
  role: UserRole;
  created_at: string;  // ISO datetime string
  updated_at: string;
}

/** Project as returned by GET /api/projects */
export interface Project {
  id: string;
  title: string;
  description: string;
  budget: number | null;
  deadline: string | null;     // ISO datetime
  status: ProjectStatus;
  buyer_id: string;
  assigned_solver_id: string | null;
  created_at: string;
  updated_at: string;
  // Expanded relations (included in detail responses)
  buyer?: User;
  assigned_solver?: User;
}

/** Request (solver bidding on a project) */
export interface ProjectRequest {
  id: string;
  project_id: string;
  solver_id: string;
  cover_letter: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  // Expanded relations
  solver?: User;
  project?: Project;
}

/** Task (sub-module within a project) */
export interface Task {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string;
  deadline: string | null;     // ISO datetime
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

/** Submission (ZIP file delivered for a task) */
export interface Submission {
  id: string;
  task_id: string;
  file_url: string;            // MinIO object path
  file_name: string;           // Original filename
  file_size: number;           // Bytes
  notes: string | null;
  status: SubmissionStatus;
  reviewer_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

// ============================================================
// API Response wrappers — match backend response conventions
// ============================================================

/** Pagination metadata returned with list endpoints */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/** Paginated list response: { data: [...], meta: { ... } } */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Single item response: { data: { ... } } */
export interface SingleResponse<T> {
  data: T;
}

/** Error response: { detail: "message" } */
export interface ErrorResponse {
  detail: string;
}

// ============================================================
// Request bodies — what the frontend sends TO the backend
// ============================================================

/** POST /api/projects — create a new project */
export interface CreateProjectPayload {
  title: string;
  description: string;
  budget?: number | null;
  deadline?: string | null;
}

/** PATCH /api/projects/{id} — update project details */
export interface UpdateProjectPayload {
  title?: string;
  description?: string;
  budget?: number | null;
  deadline?: string | null;
}

/** POST /api/projects/{id}/requests — request to work on project */
export interface CreateRequestPayload {
  cover_letter: string;
}

/** POST /api/projects/{id}/tasks — create a task */
export interface CreateTaskPayload {
  title: string;
  description: string;
  deadline?: string | null;
}

/** PATCH /api/tasks/{id} — update task details */
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  deadline?: string | null;
}

/** PATCH /api/submissions/{id}/reject — reject with notes */
export interface RejectSubmissionPayload {
  reviewer_notes: string;
}

/** PATCH /api/users/me/profile — update solver profile */
export interface UpdateProfilePayload {
  bio?: string | null;
  skills?: string[];
}

/** PATCH /api/users/{id}/role — admin promotes user */
export interface UpdateRolePayload {
  role: UserRole;
}

// ============================================================
// Auth types — login/token responses
// ============================================================

/** Response from POST /api/auth/dev-login and POST /api/auth/refresh */
export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
}

/** Dev login request body */
export interface DevLoginPayload {
  email: string;
}
