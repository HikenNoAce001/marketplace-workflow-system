# Requirements — Marketplace Project Workflow System

## System Overview

A role-based project marketplace with exactly 3 user roles (Admin, Buyer, Problem Solver).
Buyers create projects, Problem Solvers bid on and execute work through sub-tasks with ZIP deliverables, and Admins manage role assignments.

This document strictly follows the provided task specification. No extra features beyond what the task document requires.

---

## Roles (Exactly 3)

### 1. Admin

- Assign Buyer role to users (promotes Problem Solver → Buyer)
- View all users and projects
- No project execution responsibilities
- Created via seed script only (never through registration)

### 2. Buyer

- Create a project
- View incoming requests from Problem Solvers
- Assign one Problem Solver to a project (by accepting their request)
- Review task submissions
- Accept or reject submitted work

### 3. Problem Solver (default role on OAuth registration)

- Create and manage a profile (bio, skills)
- Browse available projects
- Request to work on a project
- Once assigned:
  - Create multiple sub-modules / tasks
  - Add metadata: title, description, timeline/deadline, status
  - Submit completed work as a ZIP file per task

### Role Flow

```
User registers via OAuth → Problem Solver (automatic)
Admin promotes Problem Solver → Buyer (via admin panel)
Admin is seeded only, never registered through UI
```

---

## Tech Stack (All Latest as of Feb 2026)

### Backend

- **Python**: 3.12+
- **Framework**: FastAPI 0.129+
- **ORM**: SQLModel 0.0.33+ — by FastAPI creator, combines SQLAlchemy 2.0 + Pydantic v2
- **Migrations**: Alembic (auto-generated from SQLModel models)
- **Database**: PostgreSQL 16
- **Async Driver**: asyncpg
- **Auth**: OAuth2 (Google + GitHub) → JWT via PyJWT 2.11+ — access 15min + refresh 7d httpOnly cookie
- **File Storage**: MinIO (S3-compatible, free, runs in Docker) via `minio` Python package
- **Validation**: Pydantic v2 (built into SQLModel + FastAPI)

### Frontend

- **Framework**: Next.js 16.1 (App Router, Turbopack default)
- **React**: 19.2 (bundled with Next.js 16)
- **Language**: TypeScript 5.1+ (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Server State**: TanStack Query v5
- **Client State**: Zustand (auth token in memory only)
- **Animation**: Framer Motion
- **HTTP**: Custom fetch wrapper with token refresh interceptor (no axios)
- **Node.js**: 20.9+ (required by Next.js 16)

### DevOps

- Docker + Docker Compose
- Services: postgres:16-alpine, minio/minio, backend, frontend
- setup.sh (one-click bootstrap), Makefile

---

## Authentication Strategy

### Token Flow (explicit, no ambiguity)

1. User clicks OAuth button → redirected to Google/GitHub
2. Provider redirects back to `/api/auth/callback/{provider}`
3. Backend exchanges code, upserts user, generates tokens
4. **Refresh token**: set as `httpOnly`, `Secure`, `SameSite=Lax` cookie (7 days)
5. **Access token**: returned in JSON response body, stored in **JS memory only** (Zustand store)
6. Frontend calls `GET /api/auth/me` on app load to hydrate user identity from access token
7. On 401: fetch wrapper calls `POST /api/auth/refresh` (sends cookie) → gets new access token
8. On refresh failure: clear Zustand store, redirect to `/auth/login`

**Access token NEVER touches localStorage or sessionStorage.**

---

## Database Schema

### Enums (minimal — only what the task PDF requires)

```
UserRole:         ADMIN | BUYER | SOLVER
ProjectStatus:    OPEN | ASSIGNED | COMPLETED
TaskStatus:       IN_PROGRESS | SUBMITTED | COMPLETED | REVISION_REQUESTED
RequestStatus:    PENDING | ACCEPTED | REJECTED
SubmissionStatus: PENDING_REVIEW | ACCEPTED | REJECTED
```

### Why these statuses and not more/fewer

**ProjectStatus** — The task PDF specifies:

- Buyer creates project → it becomes available (OPEN)
- Problem Solvers request → Buyer selects one → project becomes ASSIGNED
- All tasks accepted → COMPLETED
- No DRAFT: PDF says "Buyer creates a project" — goes directly to OPEN
- No IN_PROGRESS: PDF only shows "unassigned → assigned", no intermediate state
- No CANCELLED: PDF never mentions cancellation

**TaskStatus** — The task PDF explicitly states:

- "Task in-progress → submitted → completed" (exact quote from UI/UX section)
- Buyer can "accept or reject submitted work" → rejection needs REVISION_REQUESTED
- No TODO: tasks start as IN_PROGRESS on creation (PDF shows no pre-start state)

---

### Table: User

| Column      | Type        | Constraints               |
| ----------- | ----------- | ------------------------- |
| id          | UUID        | PK, auto-generated        |
| email       | str         | not null                  |
| name        | str         | not null                  |
| avatar_url  | str \| None | nullable                  |
| bio         | str \| None | nullable (solver profile) |
| skills      | list[str]   | default []                |
| provider    | str         | GOOGLE or GITHUB          |
| provider_id | str         | not null                  |
| role        | UserRole    | default: SOLVER           |
| created_at  | datetime    | auto                      |
| updated_at  | datetime    | auto                      |
|             |             | UNIQUE(email, provider)   |

### Table: Project

| Column             | Type             | Constraints         |
| ------------------ | ---------------- | ------------------- |
| id                 | UUID             | PK                  |
| title              | str              | not null            |
| description        | str              | text, not null      |
| budget             | Decimal \| None  | nullable            |
| deadline           | datetime \| None | nullable            |
| status             | ProjectStatus    | default: OPEN       |
| buyer_id           | UUID             | FK → User, not null |
| assigned_solver_id | UUID \| None     | FK → User, nullable |
| created_at         | datetime         | auto                |
| updated_at         | datetime         | auto                |

### Table: ProjectRequest

| Column       | Type          | Constraints                   |
| ------------ | ------------- | ----------------------------- |
| id           | UUID          | PK                            |
| project_id   | UUID          | FK → Project                  |
| solver_id    | UUID          | FK → User                     |
| cover_letter | str           | text, not null                |
| status       | RequestStatus | default: PENDING              |
| created_at   | datetime      | auto                          |
| updated_at   | datetime      | auto                          |
|              |               | UNIQUE(project_id, solver_id) |

### Table: Task

| Column      | Type             | Constraints          |
| ----------- | ---------------- | -------------------- |
| id          | UUID             | PK                   |
| project_id  | UUID             | FK → Project         |
| created_by  | UUID             | FK → User (solver)   |
| title       | str              | not null             |
| description | str              | text, not null       |
| deadline    | datetime \| None | nullable             |
| status      | TaskStatus       | default: IN_PROGRESS |
| created_at  | datetime         | auto                 |
| updated_at  | datetime         | auto                 |

### Table: Submission

| Column         | Type             | Constraints             |
| -------------- | ---------------- | ----------------------- |
| id             | UUID             | PK                      |
| task_id        | UUID             | FK → Task               |
| file_url       | str              | MinIO object path       |
| file_name      | str              | original filename       |
| file_size      | int              | bytes                   |
| notes          | str \| None      | nullable                |
| status         | SubmissionStatus | default: PENDING_REVIEW |
| reviewer_notes | str \| None      | nullable                |
| submitted_at   | datetime         | auto                    |
| reviewed_at    | datetime \| None | nullable                |

### Table: RefreshToken

| Column     | Type     | Constraints |
| ---------- | -------- | ----------- |
| id         | UUID     | PK          |
| user_id    | UUID     | FK → User   |
| token_hash | str      | not null    |
| expires_at | datetime | not null    |
| created_at | datetime | auto        |

### Indexes

- Project: (buyer_id), (status)
- ProjectRequest: (project_id), (solver_id)
- Task: (project_id), (status)

---

## Multi-Submission Behavior (explicit rules)

A task can have **multiple submissions** (resubmission after rejection).

1. Solver uploads ZIP → new Submission row created with `PENDING_REVIEW` → task → SUBMITTED
2. Only **one submission per task** can be `PENDING_REVIEW` at a time
3. Buyer accepts → that submission `ACCEPTED`, task → COMPLETED
4. Buyer rejects with reviewer notes → that submission `REJECTED`, task → REVISION_REQUESTED
5. Solver reworks → uploads new submission (new row, not update) → task back to SUBMITTED
6. Previous submissions remain as history (never deleted, never modified)
7. `GET /tasks/{id}/submissions` returns all submissions ordered by `submitted_at DESC`

---

## Core Workflow (from task PDF — implement exactly)

1. Admin assigns Buyer role to a user
2. Buyer creates a project (status: OPEN)
3. Problem Solvers request to work on the project
4. Buyer selects one Problem Solver (accepts request)
5. Project becomes ASSIGNED
6. Problem Solver creates tasks (start as IN_PROGRESS), adds metadata, submits ZIP per task
7. Buyer reviews → accepts → task completed
8. When all tasks completed → project auto-completes

---

## API Routes

### Auth (/api/auth)

| Method | Endpoint             | Description                     | Auth   |
| ------ | -------------------- | ------------------------------- | ------ |
| GET    | /google              | Redirect to Google OAuth        | No     |
| GET    | /github              | Redirect to GitHub OAuth        | No     |
| GET    | /callback/{provider} | OAuth callback, returns tokens  | No     |
| GET    | /me                  | Current user from access token  | JWT    |
| POST   | /refresh             | Rotate refresh token via cookie | Cookie |
| POST   | /logout              | Invalidate refresh token        | JWT    |

### Users (/api/users)

| Method | Endpoint    | Description                             | Auth              |
| ------ | ----------- | --------------------------------------- | ----------------- |
| GET    | /           | List all users (paginated, role filter) | ADMIN             |
| GET    | /{id}       | User profile                            | Any authenticated |
| PATCH  | /{id}/role  | Promote SOLVER → BUYER                  | ADMIN             |
| PATCH  | /me/profile | Update bio + skills                     | SOLVER            |

### Projects (/api/projects)

| Method | Endpoint | Description                 | Auth              |
| ------ | -------- | --------------------------- | ----------------- |
| POST   | /        | Create project (OPEN)       | BUYER             |
| GET    | /        | List projects (role-aware)  | Any authenticated |
| GET    | /{id}    | Project detail (role-aware) | Any authenticated |
| PATCH  | /{id}    | Update project (OPEN only)  | BUYER (owner)     |

### Requests (/api/projects/{id}/requests + /api/requests)

| Method | Endpoint                | Description      | Auth                  |
| ------ | ----------------------- | ---------------- | --------------------- |
| POST   | /projects/{id}/requests | Request to work  | SOLVER                |
| GET    | /projects/{id}/requests | List requests    | BUYER (project owner) |
| GET    | /requests/me            | My sent requests | SOLVER                |
| PATCH  | /requests/{id}/accept   | Accept request   | BUYER (project owner) |
| PATCH  | /requests/{id}/reject   | Reject request   | BUYER (project owner) |

### Tasks (/api/projects/{id}/tasks)

| Method | Endpoint             | Description         | Auth              |
| ------ | -------------------- | ------------------- | ----------------- |
| POST   | /projects/{id}/tasks | Create task         | SOLVER (assigned) |
| GET    | /projects/{id}/tasks | List project tasks  | BUYER / SOLVER    |
| PATCH  | /tasks/{id}          | Update task details | SOLVER (assigned) |

### Submissions (/api/tasks/{id}/submissions + /api/submissions)

| Method | Endpoint                   | Description                | Auth                  |
| ------ | -------------------------- | -------------------------- | --------------------- |
| POST   | /tasks/{id}/submissions    | Upload ZIP + notes         | SOLVER (assigned)     |
| GET    | /tasks/{id}/submissions    | List all submissions       | BUYER / SOLVER        |
| GET    | /submissions/{id}/download | Presigned download URL     | BUYER / SOLVER        |
| PATCH  | /submissions/{id}/accept   | Accept → task COMPLETED    | BUYER (project owner) |
| PATCH  | /submissions/{id}/reject   | Reject with reviewer notes | BUYER (project owner) |

---

## State Machines

### Project Transitions (PDF: "unassigned → assigned")

```
OPEN → ASSIGNED → COMPLETED
```

- OPEN → ASSIGNED: Auto when buyer accepts a request
- ASSIGNED → COMPLETED: Auto when ALL tasks reach COMPLETED

### Task Transitions (PDF: "in-progress → submitted → completed")

```
IN_PROGRESS → SUBMITTED → COMPLETED
                   │
                   └→ REVISION_REQUESTED → IN_PROGRESS (rework cycle)
```

- IN_PROGRESS → SUBMITTED: Auto when ZIP uploaded (new submission)
- SUBMITTED → COMPLETED: Buyer accepts submission
- SUBMITTED → REVISION_REQUESTED: Buyer rejects with notes
- REVISION_REQUESTED → IN_PROGRESS: Solver begins rework

### Request Transitions

```
PENDING → ACCEPTED | REJECTED
```

### Auto-Cascade Rules (ALL must execute inside a single DB transaction)

1. **Accept request** → in one transaction: reject all other PENDING requests for same project → set assigned_solver_id → project status ASSIGNED
2. **Upload submission** → in one transaction: create Submission row with PENDING_REVIEW → task status SUBMITTED
3. **Accept submission** → in one transaction: submission status ACCEPTED → task status COMPLETED → check if ALL project tasks COMPLETED → if yes, project status COMPLETED

---

## File Upload Rules

- ZIP files ONLY
- Validate using Python's `zipfile.is_zipfile()` — handles all valid ZIP variants correctly (not just `PK\x03\x04`, also covers empty archives and spanned archives)
- Additionally validate: file extension is `.zip` and MIME type is `application/zip`
- Max size: 50MB (configurable via MAX_UPLOAD_SIZE_MB env)
- MinIO storage path: `submissions/{project_id}/{task_id}/{uuid}.zip`
- Download: presigned GET URLs with 1-hour expiry
- NEVER serve files directly through the backend

---

## Response Conventions

- Success list: `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 42, "total_pages": 3 } }`
- Success single: `{ "data": { ... } }`
- Error: `{ "detail": "Human-readable message" }`
- Status codes: 200 (ok), 201 (created), 204 (deleted), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 422 (validation error), 500 (server error)

---

## Environment Variables (.env.example)

```env
# Database (asyncpg driver for async operations)
DATABASE_URL=postgresql+asyncpg://marketplace:marketplace@localhost:5432/marketplace

# MinIO (free, runs in Docker)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=marketplace-uploads
MINIO_USE_SSL=false

# Google OAuth (free: console.cloud.google.com)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/callback/google

# GitHub OAuth (free: github.com/settings/developers)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:8000/api/auth/callback/github

# JWT
JWT_SECRET=change-me-to-random-64-char-string
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# App
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
MAX_UPLOAD_SIZE_MB=50

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
```

---

## Deployment (All Free Tier)

| Component    | Platform                          | Cost |
| ------------ | --------------------------------- | ---- |
| Frontend     | Vercel                            | Free |
| Backend      | Render                            | Free |
| Database     | Render PostgreSQL or Supabase     | Free |
| File Storage | Supabase Storage or Cloudflare R2 | Free |
