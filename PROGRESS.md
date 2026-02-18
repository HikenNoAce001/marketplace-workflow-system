# Build Progress — Marketplace Project Workflow System

## Architecture Flowchart

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                               │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │  PostgreSQL   │   │    MinIO     │   │       Backend          │  │
│  │  :5432        │   │  :9000 API   │   │       :8000            │  │
│  │               │   │  :9001 UI    │   │                        │  │
│  │  marketplace  │   │              │   │  FastAPI + Uvicorn     │  │
│  │  database     │   │  ZIP storage │   │  ┌──────────────────┐  │  │
│  │               │   │              │   │  │ app/main.py       │  │  │
│  │               │   │              │   │  │  ├─ lifespan      │  │  │
│  │               │   │              │   │  │  ├─ CORS          │  │  │
│  │               │   │              │   │  │  └─ /api/health   │  │  │
│  │               │   │              │   │  ├──────────────────┤  │  │
│  │               │◄──┼──────────────┼───┤  │ app/config.py    │  │  │
│  │               │   │              │   │  │  └─ BaseSettings  │  │  │
│  │               │   │              │   │  ├──────────────────┤  │  │
│  │               │◄──┼──────────────┼───┤  │ app/database.py  │  │  │
│  │               │   │              │   │  │  ├─ async engine  │  │  │
│  │               │   │              │   │  │  └─ session pool  │  │  │
│  │               │   │              │   │  ├──────────────────┤  │  │
│  │               │   │              │   │  │ alembic/         │  │  │
│  │               │◄──┼──────────────┼───┤  │  └─ migrations   │  │  │
│  │               │   │              │   │  └──────────────────┘  │  │
│  └──────────────┘   └──────────────┘   └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Build Stages

### ✅ STAGE 1 — Foundation & Infrastructure (COMPLETE)

Goal: Get a running backend server with Docker, database connection, and health check.

```
Step Flow:

  pyproject.toml          What: Project manifest + all dependencies
       │                  Why: Defines what Python packages we need
       │                  Key: fastapi, sqlmodel, asyncpg, alembic, pyjwt, minio
       ▼
  app/config.py           What: Pydantic BaseSettings — all env vars typed
       │                  Why: Single source of truth for configuration
       │                  Key: Reads from .env file, typed defaults, one importable object
       ▼
  app/database.py         What: Async engine + session factory + get_session()
       │                  Why: Connection pool for PostgreSQL via asyncpg
       │                  Key: expire_on_commit=False, yield-based session lifecycle
       ▼
  app/main.py             What: FastAPI app with lifespan, CORS, /api/health
       │                  Why: Entry point — startup DB check, CORS for frontend
       │                  Key: SELECT 1 on startup (fail-fast), engine.dispose on shutdown
       ▼
  Dockerfile              What: Python 3.12-slim container with live reload
       │                  Why: Consistent environment, layer-cached deps
       │                  Key: Copy pyproject.toml first (cache), --reload for dev
       ▼
  docker-compose.yml      What: postgres + minio + backend orchestration
       │                  Why: One command to spin up entire stack
       │                  Key: healthchecks, volume mounts, service hostname overrides
       ▼
  alembic.ini + env.py    What: Migration configuration (async)
       │                  Why: Schema changes tracked in version control
       │                  Key: Imports all models via app/models/__init__.py
       ▼
  .env.example            What: Template env vars with safe defaults
  setup.sh                What: One-click bootstrap script
  Makefile                What: Shortcut commands (make up, make logs, make migrate)
       │
       ▼
  ✅ docker compose up → postgres healthy → backend boots → SELECT 1 → /api/health returns ok
```

**Files created in this stage:**
| File | Purpose |
|------|---------|
| `backend/pyproject.toml` | Dependencies + build config |
| `backend/app/config.py` | Typed env var loading |
| `backend/app/database.py` | Async DB engine + session |
| `backend/app/main.py` | FastAPI app + health endpoint |
| `backend/app/models/__init__.py` | Model registry for Alembic |
| `backend/Dockerfile` | Container build instructions |
| `backend/alembic.ini` | Alembic config |
| `backend/alembic/env.py` | Async migration runner |
| `docker-compose.yml` | Service orchestration |
| `.env.example` | Env var template |
| `setup.sh` | Bootstrap script |
| `Makefile` | Dev shortcuts |

**Connections established:**
```
Backend ──asyncpg──► PostgreSQL (verified by SELECT 1 on startup)
Backend ──config───► .env file (via Pydantic BaseSettings)
Alembic ──asyncpg──► PostgreSQL (via same config)
Docker ──healthcheck► All services healthy before backend starts
```

---

### ✅ STAGE 2 — Database Models (COMPLETE)

Goal: Define all 6 tables with SQLModel, generate first Alembic migration.

```
Step Flow:

  models/user.py          User table + UserRole enum
       │                  Fields: id, email, name, avatar_url, bio, skills, provider,
       │                          provider_id, role, created_at, updated_at
       │                  Unique: (email, provider)
       ▼
  models/project.py       Project table + ProjectStatus enum
       │                  Fields: id, title, description, budget, deadline, status,
       │                          buyer_id (FK→User), assigned_solver_id (FK→User)
       ▼
  models/request.py       ProjectRequest table + RequestStatus enum
       │                  Fields: id, project_id (FK), solver_id (FK), cover_letter, status
       │                  Unique: (project_id, solver_id) — one request per solver per project
       ▼
  models/task.py          Task table + TaskStatus enum
       │                  Fields: id, project_id (FK), created_by (FK), title, description,
       │                          deadline, status
       ▼
  models/submission.py    Submission table + SubmissionStatus enum
       │                  Fields: id, task_id (FK), file_url, file_name, file_size, notes,
       │                          status, reviewer_notes, submitted_at, reviewed_at
       ▼
  models/refresh_token.py RefreshToken table
       │                  Fields: id, user_id (FK), token_hash, expires_at
       ▼
  models/__init__.py      Import ALL models (required for Alembic autogenerate)
       │
       ▼
  alembic revision --autogenerate -m "initial tables"
       │
       ▼
  alembic upgrade head → 6 tables created in PostgreSQL
```

**Files created in this stage:**
| File | Purpose |
|------|---------|
| `backend/app/models/user.py` | User table + UserRole enum (ADMIN, BUYER, SOLVER) |
| `backend/app/models/project.py` | Project table + ProjectStatus (OPEN, ASSIGNED, COMPLETED) |
| `backend/app/models/request.py` | ProjectRequest table + RequestStatus (PENDING, ACCEPTED, REJECTED) |
| `backend/app/models/task.py` | Task table + TaskStatus (IN_PROGRESS, SUBMITTED, COMPLETED, REVISION_REQUESTED) |
| `backend/app/models/submission.py` | Submission table + SubmissionStatus (PENDING_REVIEW, ACCEPTED, REJECTED) |
| `backend/app/models/refresh_token.py` | RefreshToken table (hashed tokens for security) |
| `backend/app/models/__init__.py` | Imports all models (required for Alembic autogenerate) |
| `backend/alembic/script.py.mako` | Mako template for generating migration files |
| `backend/alembic/versions/..._initial_tables.py` | First migration — creates all 6 tables |

**Key design decisions:**
- `UniqueConstraint("email", "provider")` on User — same email allowed across Google/GitHub
- `UniqueConstraint("project_id", "solver_id")` on ProjectRequest — one bid per solver per project
- Task starts as `IN_PROGRESS` (no TODO state — per PDF spec)
- Submission stores `token_hash` not raw token — DB leak doesn't expose tokens
- Submission has `submitted_at` + `reviewed_at` instead of `updated_at` — submissions are immutable
- All PKs are UUID generated in Python (`uuid4()`) — known before DB insert

**Table relationship map:**
```
users ◄──────── projects.buyer_id
users ◄──────── projects.assigned_solver_id
users ◄──────── project_requests.solver_id
users ◄──────── tasks.created_by
users ◄──────── refresh_tokens.user_id
projects ◄───── project_requests.project_id
projects ◄───── tasks.project_id
tasks ◄──────── submissions.task_id
```

---

### ✅ STAGE 3 — Auth System (OAuth + JWT) (COMPLETE)

Goal: Google/GitHub OAuth login, JWT access/refresh tokens, user session management.

```
Step Flow:

  auth/utils.py           What: JWT encode/decode + token hashing helpers
       │                  Key: create_access_token (15min), create_refresh_token (random 64B),
       │                       hash_token (SHA-256), decode_access_token (verify + decode)
       ▼
  auth/schemas.py         What: Response shapes for auth endpoints
       │                  Key: TokenResponse {access_token, token_type}
       │                       AuthURLResponse {url}, UserRead {id, email, name, role...}
       ▼
  auth/service.py         What: ALL auth business logic
       │                  Key functions:
       │                    get_google_auth_url()     → Build OAuth consent URL
       │                    get_github_auth_url()     → Build OAuth auth URL
       │                    exchange_google_code()    → code → access_token → user info
       │                    exchange_github_code()    → code → access_token → user info
       │                    upsert_user()             → Create new or update existing user
       │                    create_and_store_refresh_token() → Raw to cookie, hash to DB
       │                    validate_refresh_token()  → Hash cookie → find in DB → return user
       │                    revoke_refresh_token()    → Delete from DB (logout)
       ▼
  auth/router.py          What: HTTP endpoints (thin — calls service functions)
       │                  Endpoints:
       │                    GET  /api/auth/google          → Returns OAuth URL
       │                    GET  /api/auth/github          → Returns OAuth URL
       │                    GET  /api/auth/callback/google → Exchange code → set cookie + token
       │                    GET  /api/auth/callback/github → Exchange code → set cookie + token
       │                    GET  /api/auth/me              → Return current user from JWT
       │                    POST /api/auth/refresh         → New access token from refresh cookie
       │                    POST /api/auth/logout          → Revoke token + clear cookie
       ▼
  dependencies.py         What: Reusable auth guards for ALL other routers
                          Key functions:
                            get_current_user()  → Decode JWT → look up user in DB
                            require_role()      → Factory: get_current_user + check role
```

**Files created in this stage:**
| File | Purpose |
|------|---------|
| `backend/app/auth/__init__.py` | Package init |
| `backend/app/auth/utils.py` | JWT create/decode, token hashing, expiry helpers |
| `backend/app/auth/schemas.py` | TokenResponse, AuthURLResponse, UserRead |
| `backend/app/auth/service.py` | OAuth exchange, user upsert, refresh token CRUD |
| `backend/app/auth/router.py` | 7 auth endpoints |
| `backend/app/dependencies.py` | get_current_user + require_role dependencies |

**Auth flow diagram:**
```
Frontend                    Backend                         Google/GitHub
   │                           │                                │
   │  GET /api/auth/google     │                                │
   │──────────────────────────►│                                │
   │  { url: "https://..." }   │                                │
   │◄──────────────────────────│                                │
   │                           │                                │
   │  Redirect user to URL     │                                │
   │──────────────────────────────────────────────────────────►│
   │                           │        User logs in on Google  │
   │  Redirect: /callback?code=abc                              │
   │◄──────────────────────────────────────────────────────────│
   │                           │                                │
   │  GET /callback/google?code=abc                             │
   │──────────────────────────►│  POST token exchange           │
   │                           │───────────────────────────────►│
   │                           │  { access_token }              │
   │                           │◄───────────────────────────────│
   │                           │  GET /userinfo                 │
   │                           │───────────────────────────────►│
   │                           │  { email, name, avatar }       │
   │                           │◄───────────────────────────────│
   │                           │                                │
   │                           │  Upsert user in DB             │
   │                           │  Create refresh token (hash→DB)│
   │                           │  Set httpOnly cookie (raw)     │
   │  { access_token }         │                                │
   │  + Set-Cookie: refresh    │                                │
   │◄──────────────────────────│                                │
   │                           │                                │
   │  Store access_token       │                                │
   │  in Zustand (memory)      │                                │
```

**Security decisions:**
- Refresh token stored as SHA-256 **hash** in DB — if DB leaks, tokens are useless
- Token rotation on refresh — each refresh token can only be used ONCE
- httpOnly cookie — JavaScript cannot read it (XSS protection)
- SameSite=Lax — CSRF protection
- Access token in memory only (Zustand) — never localStorage/sessionStorage
- ADMIN_EMAIL env var — first admin auto-created on OAuth login

---

### ✅ STAGE 4 — User Management (COMPLETE)

Goal: Admin can list users and promote SOLVER → BUYER. Solvers can edit profile.

```
Step Flow:

  users/schemas.py        What: Request/response shapes
       │                  Key: UserRead, UserUpdateRole, UserUpdateProfile, UserListResponse
       ▼
  users/service.py        What: User business logic
       │                  Key functions:
       │                    list_users()        → Paginated list (ADMIN only)
       │                    get_user_by_id()    → Single user lookup
       │                    update_user_role()  → SOLVER ↔ BUYER (never ADMIN)
       │                    update_profile()    → Bio + skills update
       ▼
  users/router.py         What: HTTP endpoints
                          Endpoints:
                            GET   /api/users              → List all (ADMIN)
                            GET   /api/users/me/profile   → Own profile (any auth)
                            GET   /api/users/{id}         → Single user (ADMIN)
                            PATCH /api/users/{id}/role    → Change role (ADMIN)
                            PATCH /api/users/me/profile   → Update own profile (any auth)
```

**Files created:**
| File | Purpose |
|------|---------|
| `backend/app/users/__init__.py` | Package init |
| `backend/app/users/schemas.py` | UserRead, UserUpdateRole, UserUpdateProfile, UserListResponse |
| `backend/app/users/service.py` | list, get, update role, update profile |
| `backend/app/users/router.py` | 5 user endpoints |

**Key rules enforced:**
- Admin can only set BUYER or SOLVER (never ADMIN — admins are seeded only)
- Admin cannot change their own role
- Admin cannot change another admin's role
- `/me/profile` route defined BEFORE `/{user_id}` to avoid FastAPI treating "me" as a UUID

---

### ✅ STAGE 5 — Projects CRUD (COMPLETE)

Goal: Buyers create/update projects. Role-aware listing.

```
Step Flow:

  projects/schemas.py     What: ProjectCreate, ProjectUpdate, ProjectRead, ProjectListResponse
       ▼
  projects/service.py     What: Project business logic
       │                  Key functions:
       │                    create_project()     → BUYER creates OPEN project
       │                    list_projects()      → Role-aware: ADMIN=all, BUYER=own, SOLVER=OPEN+assigned
       │                    get_project_by_id()  → Role-aware access control
       │                    update_project()     → BUYER, own project, OPEN status only
       ▼
  projects/router.py      Endpoints:
                            POST  /api/projects          → Create (BUYER, 201)
                            GET   /api/projects          → List (role-filtered)
                            GET   /api/projects/{id}     → Single (role-checked)
                            PATCH /api/projects/{id}     → Update (BUYER, OPEN only)
```

**Files created:**
| File | Purpose |
|------|---------|
| `backend/app/projects/__init__.py` | Package init |
| `backend/app/projects/schemas.py` | Create, Update, Read, ListResponse schemas |
| `backend/app/projects/service.py` | CRUD with role-aware filtering |
| `backend/app/projects/router.py` | 4 project endpoints |

**Key rules enforced:**
- Only BUYER can create/update projects
- Projects can only be updated while OPEN (ASSIGNED/COMPLETED are locked)
- SOLVER sees OPEN projects (to browse) + projects assigned to them
- BUYER sees only their own projects
- ADMIN sees all projects

---

### ✅ STAGE 6 — Request System (Bidding) (COMPLETE)

Goal: Solvers request to work. Buyers accept/reject. Auto-cascade on accept.

```
Step Flow:

  requests/schemas.py     What: RequestCreate, RequestRead, RequestListResponse
       ▼
  requests/service.py     What: Bidding logic + FIRST CASCADE TRANSACTION
       │                  Key functions:
       │                    create_request()              → Solver bids (OPEN projects only)
       │                    list_requests_for_project()   → Buyer sees bids on their project
       │                    list_my_requests()            → Solver sees their own bids
       │                    accept_request()              → CASCADE (see below)
       │                    reject_request()              → Simple status change
       ▼
  requests/router.py      Endpoints:
                            POST  /api/projects/{id}/requests       → Bid (SOLVER)
                            GET   /api/projects/{id}/requests       → View bids (BUYER)
                            GET   /api/requests/me                  → My bids (SOLVER)
                            PATCH /api/requests/{id}/accept         → Accept (BUYER, CASCADE)
                            PATCH /api/requests/{id}/reject         → Reject (BUYER)
```

**CASCADE: accept_request() — single transaction:**
```
async with session.begin():
    ① request.status = ACCEPTED
    ② UPDATE project_requests SET status=REJECTED WHERE project_id=X AND id!=this AND status=PENDING
    ③ project.assigned_solver_id = request.solver_id
    ④ project.status = ASSIGNED
    — all 4 commit together or all roll back
```

**Files created:**
| File | Purpose |
|------|---------|
| `backend/app/requests/__init__.py` | Package init |
| `backend/app/requests/schemas.py` | RequestCreate, RequestRead, RequestListResponse |
| `backend/app/requests/service.py` | Bidding logic + accept cascade transaction |
| `backend/app/requests/router.py` | 5 request endpoints |

**Key rules enforced:**
- Only SOLVER can bid, only on OPEN projects
- One bid per solver per project (DB unique constraint + service check)
- Only BUYER can accept/reject (must own the project)
- Accept cascades: auto-reject others + assign solver + project ASSIGNED
- All cascade steps in one DB transaction (atomic)

---

### ✅ STAGE 7 — Task Management (COMPLETE)

Goal: Assigned solvers create/update tasks on their project.

```
Step Flow:

  tasks/schemas.py        What: TaskCreate, TaskUpdate, TaskRead, TaskListResponse
       ▼
  tasks/service.py        What: Task CRUD logic
       │                  Key functions:
       │                    create_task()              → SOLVER creates on ASSIGNED project
       │                    list_tasks_for_project()   → Role-aware (ADMIN/BUYER/SOLVER)
       │                    get_task_by_id()           → Single task with access check
       │                    update_task()              → Metadata only, not status
       ▼
  tasks/router.py         Endpoints:
                            POST  /api/projects/{id}/tasks    → Create (SOLVER)
                            GET   /api/projects/{id}/tasks    → List (role-aware)
                            GET   /api/tasks/{id}             → Single (role-aware)
                            PATCH /api/tasks/{id}             → Update metadata (SOLVER)
```

**Key rules enforced:**
- Only assigned solver can create tasks (not any solver)
- Project must be ASSIGNED (not OPEN, not COMPLETED)
- Tasks start as IN_PROGRESS (no TODO state)
- Task status is NOT directly editable — managed by submissions system
- Cannot update COMPLETED tasks

---

### ✅ STAGE 8 — Submissions & File Upload (COMPLETE)

Goal: ZIP upload to MinIO, presigned download, buyer accept/reject with cascades.

```
Step Flow:

  storage/service.py      What: MinIO file operations
       │                  Key functions:
       │                    ensure_bucket_exists()  → Called on startup, creates bucket if missing
       │                    validate_zip()          → 4 checks: extension, MIME, is_zipfile(), size
       │                    upload_file()           → Stores in MinIO at submissions/{proj}/{task}/{uuid}.zip
       │                    get_presigned_url()     → 1-hour temporary download link
       ▼
  submissions/schemas.py  What: SubmissionRead, SubmissionReject, SubmissionDownloadResponse
       ▼
  submissions/service.py  What: Submission logic with 2 CASCADE transactions
       │                  Key functions:
       │                    create_submission()     → CASCADE 1: validate + upload + submission + task SUBMITTED
       │                    accept_submission()     → CASCADE 2: accept + task COMPLETED + maybe project COMPLETED
       │                    reject_submission()     → submission REJECTED + task REVISION_REQUESTED
       │                    list_submissions()      → Full revision history (newest first)
       │                    get_download_url()      → Presigned URL from MinIO
       ▼
  submissions/router.py   Endpoints:
                            POST  /api/tasks/{id}/submissions       → Upload ZIP (SOLVER, multipart)
                            GET   /api/tasks/{id}/submissions       → List history (role-aware)
                            GET   /api/submissions/{id}/download    → Presigned URL (role-aware)
                            PATCH /api/submissions/{id}/accept      → Accept (BUYER, CASCADE)
                            PATCH /api/submissions/{id}/reject      → Reject (BUYER)
```

**CASCADE 1 — Upload:**
```
async with session.begin():
    ① Check no existing PENDING_REVIEW submission
    ② Create Submission (PENDING_REVIEW)
    ③ Task → SUBMITTED
```

**CASCADE 2 — Accept:**
```
async with session.begin():
    ① Submission → ACCEPTED
    ② Task → COMPLETED
    ③ SELECT COUNT(*) FROM tasks WHERE project_id=X AND status != COMPLETED
       If 0 → Project → COMPLETED (auto-complete!)
```

**ZIP validation (4 mandatory checks):**
```
1. Extension: filename.lower().endswith(".zip")
2. MIME:      content_type == "application/zip"
3. Structure: zipfile.is_zipfile(io.BytesIO(file_bytes))
4. Size:      len(file_bytes) <= MAX_UPLOAD_SIZE_MB * 1024 * 1024
```

**Files created:**
| File | Purpose |
|------|---------|
| `backend/app/storage/__init__.py` | Package init |
| `backend/app/storage/service.py` | MinIO client, ZIP validation, upload, presigned URLs |
| `backend/app/submissions/__init__.py` | Package init |
| `backend/app/submissions/schemas.py` | Read, Reject, Download, List schemas |
| `backend/app/submissions/service.py` | 2 cascade transactions + CRUD |
| `backend/app/submissions/router.py` | 5 submission endpoints |

---

### ✅ STAGE 9 — Seed Script + Dev Testing (COMPLETE)

Goal: Create test users and dev login endpoint for testing the full API.

```
Step Flow:

  scripts/seed.py         What: Creates 3 test users (one per role)
       │                  Users: admin@test.com, buyer@test.com, solver@test.com
       │                  Idempotent: safe to run multiple times
       ▼
  auth/router.py          What: Added POST /api/auth/dev-login
                          How: Send {"email": "buyer@test.com"} → get access_token
                          DEV ONLY — remove before production
```

**How to test the full workflow:**
```
1. make seed                              → Create test users
2. POST /api/auth/dev-login               → {"email": "buyer@test.com"} → copy access_token
3. Click "Authorize" in Swagger UI        → paste "Bearer <token>"
4. POST /api/projects                     → Create a project (as buyer)
5. POST /api/auth/dev-login               → {"email": "solver@test.com"} → new token
6. POST /api/projects/{id}/requests       → Bid on the project (as solver)
7. POST /api/auth/dev-login               → {"email": "buyer@test.com"} → switch back
8. PATCH /api/requests/{id}/accept        → Accept bid (CASCADE: assign solver)
9. POST /api/auth/dev-login               → {"email": "solver@test.com"}
10. POST /api/projects/{id}/tasks         → Create a task
11. POST /api/tasks/{id}/submissions      → Upload ZIP
12. POST /api/auth/dev-login              → {"email": "buyer@test.com"}
13. PATCH /api/submissions/{id}/accept    → Accept (CASCADE: task+project COMPLETED)
```

**Bug fixes applied during testing:**

1. **Transaction error (500)**: `async with session.begin()` failed because FastAPI's
   dependency injection already starts a transaction. Fixed by removing `session.begin()`
   from all cascade functions and using a single `session.commit()` at the end instead.
   Files fixed:
   - `requests/service.py` — `accept_request()`
   - `submissions/service.py` — `create_submission()` and `accept_submission()`

2. **Swagger UI missing Authorize button**: Added OpenAPI security scheme to `main.py`
   so the Swagger docs show a Bearer Token authorize button.

**Files modified:**
| File | Change |
|------|--------|
| `backend/app/main.py` | Added `custom_openapi()` with BearerAuth security scheme |
| `backend/app/requests/service.py` | Removed `session.begin()`, use `session.commit()` |
| `backend/app/submissions/service.py` | Same fix in both cascade functions |

---

### ✅ STAGE 9b — Automated E2E Test (COMPLETE)

Goal: One-command test that runs the full workflow automatically.

```
Step Flow:

  scripts/test_workflow.py    What: Automated 8-step test using httpx
       │                      How: Logs in as buyer/solver, creates project,
       │                           bids, accepts, creates task, uploads ZIP,
       │                           accepts submission — prints every request/response
       ▼
  Makefile                    What: Added 'make test-flow' command
                              How: docker compose exec backend python -m scripts.test_workflow
```

**Test results (all passed):**
```
Step 1: Login buyer        → 200 OK
Step 2: Create project     → 201 Created (status: OPEN)
Step 3: Login solver       → 200 OK
Step 4: Bid on project     → 201 Created (status: PENDING)
Step 5: Accept bid         → 200 OK (CASCADE: ACCEPTED, project → ASSIGNED)
Step 6: Create task        → 201 Created (status: IN_PROGRESS)
Step 7: Upload ZIP         → 201 Created (status: PENDING_REVIEW, task → SUBMITTED)
Step 8: Accept submission  → 200 OK (CASCADE: task → COMPLETED, project → COMPLETED)
```

**Full lifecycle verified:**
```
Project:    OPEN → ASSIGNED → COMPLETED ✓
Request:    PENDING → ACCEPTED ✓
Task:       IN_PROGRESS → SUBMITTED → COMPLETED ✓
Submission: PENDING_REVIEW → ACCEPTED ✓
```

**Files created:**
| File | Purpose |
|------|---------|
| `backend/scripts/test_workflow.py` | Automated E2E test with colored output |

---

### ✅ STAGE 10a — Frontend Scaffolding (COMPLETE)

Goal: Set up Next.js 16.1 project with all dependencies, folder structure, stores, API client, and Docker.

```
Frontend Architecture:

┌─────────────────────────────────────────────────────────────────┐
│  Next.js 16.1 (App Router + Turbopack)  — localhost:3000       │
│                                                                 │
│  src/                                                           │
│  ├── app/                    ← Pages (each folder = URL route)  │
│  │   ├── layout.tsx          ← Root layout (wraps everything)   │
│  │   ├── page.tsx            ← Landing page "/"                 │
│  │   ├── auth/login/         ← "/auth/login"                   │
│  │   ├── auth/callback/      ← "/auth/callback" (OAuth return) │
│  │   ├── dashboard/          ← "/dashboard" (role-specific)     │
│  │   ├── admin/users/        ← "/admin/users" (ADMIN only)     │
│  │   ├── admin/projects/     ← "/admin/projects" (ADMIN only)  │
│  │   ├── buyer/projects/     ← "/buyer/projects" (BUYER only)  │
│  │   ├── buyer/projects/new/ ← "/buyer/projects/new"           │
│  │   ├── buyer/projects/[id] ← "/buyer/projects/:id"           │
│  │   ├── solver/profile/     ← "/solver/profile" (SOLVER only) │
│  │   ├── solver/projects/[id]← "/solver/projects/:id"          │
│  │   └── solver/requests/    ← "/solver/requests"              │
│  │                                                               │
│  ├── components/                                                 │
│  │   ├── ui/                 ← shadcn/ui (15 base components)   │
│  │   └── providers.tsx       ← TanStack Query + Toast provider  │
│  │                                                               │
│  ├── lib/                                                        │
│  │   ├── api-client.ts       ← Custom fetch wrapper + auto-refresh│
│  │   └── utils.ts            ← cn() helper for Tailwind classes │
│  │                                                               │
│  ├── hooks/                  ← TanStack Query hooks (per module)│
│  ├── stores/                                                     │
│  │   └── auth-store.ts       ← Zustand (access token in memory) │
│  └── types/                                                      │
│      └── index.ts            ← TypeScript types → backend schemas│
└─────────────────────────────────────────────────────────────────┘
```

**Frontend ↔ Backend Connection Flow:**
```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Browser    │        │   Next.js    │        │   FastAPI     │
│   (Client)   │        │   :3000      │        │   :8000       │
│              │        │              │        │               │
│  Zustand     │──GET──►│  page.tsx    │──fetch─►│  /api/...    │
│  (token in   │  page  │  (SSR or    │  with   │  (endpoints) │
│   memory)    │◄─HTML──│   client)   │◄─JSON───│              │
│              │        │              │        │               │
│  api-client  │        │              │        │               │
│  .ts wraps   │        │              │        │               │
│  every call  │        │              │        │               │
│  with Bearer │        │              │        │               │
│  token       │        │              │        │               │
└──────────────┘        └──────────────┘        └──────────────┘
```

**Token lifecycle (frontend perspective):**
```
App loads
    │
    ├── Try POST /api/auth/refresh (sends httpOnly cookie)
    │   ├── 200 → store access_token in Zustand → fetch /api/auth/me → set user
    │   └── 401 → show login page
    │
    │  On every API call (via api-client.ts):
    │   ├── Attach Authorization: Bearer <token> from Zustand
    │   ├── If 401 → try refresh → retry request
    │   └── If refresh fails → logout → redirect to /auth/login
    │
    └── On logout → clear Zustand → clear cookie → redirect to /auth/login
```

**Packages installed:**
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | App Router + Turbopack (framework) |
| `react` + `react-dom` | 19.2.3 | UI library |
| `typescript` | ^5 | Type safety (strict mode) |
| `tailwindcss` | v4 | Utility-first CSS (new CSS-based config) |
| `@tailwindcss/postcss` | v4 | PostCSS plugin for Tailwind |
| `@tanstack/react-query` | 5.90+ | Server state (API calls, caching, loading/error) |
| `zustand` | 5.0+ | Client state (auth token in memory only) |
| `framer-motion` | 12.34+ | Page transitions, micro-interactions |
| `gsap` | 3.14+ | Timeline/stepper animations (lifecycle visualization) |
| `lucide-react` | 0.574+ | Icons (used by shadcn/ui) |
| `class-variance-authority` | 0.7+ | Type-safe component variants |
| `clsx` + `tailwind-merge` | latest | Tailwind class merging utility |
| `sonner` | latest | Toast notifications (success/error feedback) |

**shadcn/ui components installed (15):**
```
button, card, input, textarea, label, badge, dialog,
dropdown-menu, avatar, skeleton, separator, table, select,
tooltip, sonner (toast)
```

**Make commands added:**
| Command | What |
|---------|------|
| `make front` | Start Next.js dev server (localhost:3000) |
| `make front-build` | Production build |
| `make front-lint` | Run ESLint |

**Files created:**
| File | Purpose |
|------|---------|
| `frontend/package.json` | Dependencies + scripts |
| `frontend/next.config.ts` | Next.js config (standalone output for Docker) |
| `frontend/tsconfig.json` | TypeScript strict mode + path aliases |
| `frontend/postcss.config.mjs` | PostCSS with Tailwind v4 plugin |
| `frontend/components.json` | shadcn/ui configuration |
| `frontend/.env.local` | NEXT_PUBLIC_API_URL=http://localhost:8000/api |
| `frontend/.dockerignore` | Excludes node_modules, .next from Docker |
| `frontend/Dockerfile` | Multi-stage build (deps → build → run) |
| `frontend/src/app/globals.css` | Tailwind v4 + shadcn CSS variables (light/dark) |
| `frontend/src/app/layout.tsx` | Root layout with fonts + Providers wrapper |
| `frontend/src/app/page.tsx` | Landing page with "Get Started" CTA |
| `frontend/src/lib/utils.ts` | cn() — Tailwind class merge utility |
| `frontend/src/lib/api-client.ts` | Custom fetch wrapper with token refresh |
| `frontend/src/stores/auth-store.ts` | Zustand — access token + user in memory |
| `frontend/src/types/index.ts` | All TypeScript types matching backend schemas |
| `frontend/src/components/providers.tsx` | TanStack Query + Toaster providers |
| `frontend/src/components/ui/*.tsx` | 15 shadcn/ui components |
| `docker-compose.yml` | Updated with frontend service |
| `Makefile` | Updated with front, front-build, front-lint |

---

### ✅ STAGE 10b — Auth Pages (Login + Middleware) (COMPLETE)

Goal: Login page with dev-login, OAuth buttons, auth middleware for route protection.

```
Auth Flow:

  /auth/login              User clicks "Admin" / "Buyer" / "Solver"
       │                   Dev login bypasses OAuth for testing
       ▼
  hooks/use-auth.ts        devLogin(email) orchestrates:
       │                   1. POST /api/auth/dev-login → access_token
       │                   2. setToken() → Zustand (memory only)
       │                   3. fetchUser() → GET /api/auth/me → user profile
       │                   4. redirectByRole() → /admin/users or /dashboard
       ▼
  stores/auth-store.ts     Zustand holds: accessToken + user
       │                   Access token NEVER in localStorage
       ▼
  lib/api-client.ts        Every API call auto-attaches Bearer token
       │                   On 401 → tries POST /auth/refresh → retry
       ▼
  proxy.ts                 Runs BEFORE page loads (server-side)
       │                   Checks refresh_token cookie exists
       │                   No cookie → redirect to /auth/login
       ▼
  auth-provider.tsx        On app load → checkSession()
                           Restores login from refresh cookie
```

Files created/modified:
| File | Purpose |
|------|---------|
| `src/proxy.ts` | Next.js 16 route protection (renamed from middleware.ts) |
| `src/app/auth/login/page.tsx` | Dev login + OAuth buttons |
| `src/app/auth/callback/page.tsx` | OAuth callback handler (Suspense-wrapped) |
| `src/app/dashboard/page.tsx` | Post-login landing page |
| `src/stores/auth-store.ts` | Zustand store for access token + user |
| `src/hooks/use-auth.ts` | Auth hook (devLogin, logout, checkSession, redirectByRole) |
| `src/components/auth-provider.tsx` | Session restore on app load |
| `src/components/providers.tsx` | QueryClient + AuthProvider + Toaster |
| `src/lib/api-client.ts` | Fetch wrapper with auto token refresh |

Key fix: `useSearchParams()` must be wrapped in `<Suspense>` for Next.js build.

---

### ✅ STAGE 10c — Admin Panel + Shared Layout (COMPLETE)

Goal: Shared app shell (navbar + sidebar) and Admin-specific pages for user/project management.

```
Admin Panel Architecture:

  app/admin/layout.tsx       Role guard: only ADMIN can access /admin/*
       │                     Wraps children with AppShell
       ▼
  components/app-shell.tsx   Shared layout for ALL authenticated pages
       │                     ┌──────────┬──────────────────┐
       │                     │ SIDEBAR  │    CONTENT       │
       │                     │ (role-   │    (page.tsx)     │
       │                     │  aware   │                   │
       │                     │  links)  │                   │
       │                     └──────────┴──────────────────┘
       ▼
  app/admin/users/page.tsx   User table + role dropdown
       │                     GET /api/users → paginated table
       │                     PATCH /api/users/{id}/role → change SOLVER ↔ BUYER
       ▼
  app/admin/projects/page.tsx  Read-only project overview
                               GET /api/projects → all projects table
                               Admin can VIEW but NOT create/edit (per PDF)
```

Data fetching pattern (TanStack Query v5):
```
hooks/use-users.ts           useUsers(page)      → GET /api/users
                             useUpdateRole()     → PATCH /api/users/{id}/role
hooks/use-projects.ts        useProjects(page)   → GET /api/projects
```

Files created/modified:
| File | Purpose |
|------|---------|
| `src/components/app-shell.tsx` | Shared navbar + sidebar (role-aware links) |
| `src/app/admin/layout.tsx` | Admin role guard + AppShell wrapper |
| `src/app/admin/users/page.tsx` | User management table with role dropdown |
| `src/app/admin/projects/page.tsx` | Read-only projects overview |
| `src/hooks/use-users.ts` | TanStack Query hooks for user endpoints |
| `src/hooks/use-projects.ts` | TanStack Query hooks for project endpoints |
| `src/hooks/use-auth.ts` | Updated redirectByRole (ADMIN → /admin/users) |
| `src/app/dashboard/page.tsx` | Wrapped with AppShell layout |

---

### ✅ STAGE 10d — Buyer Pages (COMPLETE)

Goal: Buyer can create projects, view incoming requests, accept/reject solvers, review submissions.

```
Buyer Pages Architecture:

  app/buyer/layout.tsx         Role guard: only BUYER can access /buyer/*
       │                       Wraps children with AppShell
       ▼
  hooks/use-buyer.ts           ALL buyer TanStack Query hooks (9 total)
       │                       Queries:  useProject, useProjectRequests,
       │                                 useProjectTasks, useTaskSubmissions
       │                       Mutations: useCreateProject, useAcceptRequest,
       │                                  useRejectRequest, useAcceptSubmission,
       │                                  useRejectSubmission
       │                       Utility:  downloadSubmission (presigned URL)
       ▼
  app/buyer/projects/page.tsx  Project list table (clickable rows)
       │                       GET /api/projects → buyer's own projects
       │                       "New Project" button → /buyer/projects/new
       ▼
  app/buyer/projects/new/      Create project form
       │                       POST /api/projects { title, desc, budget?, deadline? }
       │                       On success → toast + redirect to list
       ▼
  app/buyer/projects/[id]/     Project detail page with 3 tabs:
                               ┌─────────────────────────────────────────────┐
                               │  [Overview]  [Requests]  [Tasks]            │
                               ├─────────────────────────────────────────────┤
                               │                                             │
                               │  Overview:  Description, Budget, Deadline,  │
                               │             Assigned Solver, Created Date   │
                               │                                             │
                               │  Requests:  Solver bids with Accept/Reject  │
                               │             buttons (OPEN projects only)    │
                               │             Accept triggers CASCADE:        │
                               │             reject others + assign + ASSIGNED│
                               │                                             │
                               │  Tasks:     Expandable task cards            │
                               │             Click task → see submissions     │
                               │             Download ZIP (presigned URL)     │
                               │             Accept/Reject submission         │
                               │             Reject requires feedback dialog  │
                               │             Accept triggers CASCADE:         │
                               │             task COMPLETED, maybe project    │
                               │             COMPLETED                        │
                               └─────────────────────────────────────────────┘
```

Buyer actions → API mapping:
```
Create project      → POST /api/projects
View own projects   → GET /api/projects (backend filters by buyer)
View requests       → GET /api/projects/{id}/requests
Accept request      → PATCH /api/requests/{id}/accept (CASCADE)
Reject request      → PATCH /api/requests/{id}/reject
View tasks          → GET /api/projects/{id}/tasks
View submissions    → GET /api/tasks/{id}/submissions
Download ZIP        → GET /api/submissions/{id}/download → presigned URL
Accept submission   → PATCH /api/submissions/{id}/accept (CASCADE)
Reject submission   → PATCH /api/submissions/{id}/reject { reviewer_notes }
```

Cache invalidation strategy (TanStack Query):
```
Accept request  → invalidate: project-requests, project, projects
                  (request statuses + project status all change)
Reject request  → invalidate: project-requests
                  (only this one request changes)
Accept submit   → invalidate: task-submissions, project-tasks, project, projects
                  (submission + task + maybe project status change)
Reject submit   → invalidate: task-submissions, project-tasks
                  (submission + task status change)
```

Files created:
| File | Purpose |
|------|---------|
| `src/app/buyer/layout.tsx` | Buyer role guard + AppShell wrapper |
| `src/hooks/use-buyer.ts` | 9 TanStack Query hooks (4 queries + 4 mutations + 1 utility) |
| `src/app/buyer/projects/page.tsx` | Project list with clickable rows + "New Project" button |
| `src/app/buyer/projects/new/page.tsx` | Create project form (title, desc, budget, deadline) |
| `src/app/buyer/projects/[id]/page.tsx` | Project detail with 3 tabs (Overview, Requests, Tasks) |
| `src/components/ui/tabs.tsx` | shadcn/ui Tabs (installed + React 19 ComponentRef fix) |

Files modified:
| File | Change |
|------|--------|
| `src/hooks/use-auth.ts` | Buyer redirect: login → `/buyer/projects` |

**Bug fix — deadline timezone mismatch:**
The `deadline` column on both `projects` and `tasks` tables was `TIMESTAMP WITHOUT TIME ZONE`,
but the frontend sends ISO strings with timezone info (e.g., `2026-02-28T00:00:00.000Z`).
asyncpg is strict about timezone mixing and threw `DataError: can't subtract offset-naive and offset-aware datetimes`.
Fixed by adding `sa_column=Column(DateTime(timezone=True), nullable=True)` to both deadline fields,
matching the pattern already used by `created_at`/`updated_at`. Migration applied.

**Utility added:**
| File | Purpose |
|------|---------|
| `backend/scripts/reset_db.py` | Truncate all tables + re-seed test users |
| `Makefile` | Added `make reset` command |

---

### ✅ STAGE 10e — Solver Pages (COMPLETE)

Goal: Solver can browse projects, submit bids, manage tasks, upload ZIP submissions, and edit profile.

```
Solver Pages Architecture:

  app/solver/layout.tsx         Role guard: only SOLVER can access /solver/*
       │                        Wraps children with AppShell
       ▼
  hooks/use-solver.ts           ALL solver TanStack Query hooks (8 total)
       │                        Queries:  useSolverProject, useSolverProjectTasks,
       │                                  useTaskSubmissions, useMyRequests
       │                        Mutations: useSubmitRequest, useCreateTask,
       │                                   useUpdateTask, useUploadSubmission
       ▼
  app/solver/projects/page.tsx  Browse OPEN projects (clickable rows)
       │                        GET /api/projects → OPEN + assigned projects
       │                        Click row → /solver/projects/{id}
       ▼
  app/solver/projects/[id]/     Project detail page with 3 sections:
                                ┌─────────────────────────────────────────────┐
                                │  Project Overview                           │
                                │  Title, Description, Budget, Deadline       │
                                │  Status badge, Assigned solver info         │
                                │                                             │
                                │  Bid Section (OPEN projects only):          │
                                │  Cover letter textarea + "Submit Bid" button│
                                │                                             │
                                │  Task Section (ASSIGNED projects):          │
                                │  "Create Task" button → title/desc form     │
                                │  Expandable task cards:                     │
                                │    Click task → see submissions list        │
                                │    Upload ZIP button (IN_PROGRESS tasks)    │
                                │    Submission history with download links   │
                                └─────────────────────────────────────────────┘
       ▼
  app/solver/requests/page.tsx  Track bid statuses across all projects
       │                        GET /api/requests/me → paginated cards
       │                        Shows PENDING (yellow), ACCEPTED (green),
       │                        REJECTED (red) with status icons
       ▼
  app/solver/profile/page.tsx   Edit solver profile (bio + skills)
                                GET /api/users/me/profile → current data
                                PATCH /api/users/me/profile → save changes
                                Skills as comma-separated input → array
```

Solver actions → API mapping:
```
Browse projects    → GET /api/projects (backend returns OPEN + assigned)
View project       → GET /api/projects/{id}
Submit bid         → POST /api/projects/{id}/requests { cover_letter }
View my requests   → GET /api/requests/me
Create task        → POST /api/projects/{id}/tasks { title, description }
Update task        → PATCH /api/tasks/{id} { title, description }
Upload ZIP         → POST /api/tasks/{id}/submissions (multipart/form-data)
View submissions   → GET /api/tasks/{id}/submissions
Download ZIP       → GET /api/submissions/{id}/download → presigned URL
Edit profile       → PATCH /api/users/me/profile { bio, skills }
```

Files created:
| File | Purpose |
|------|---------|
| `src/app/solver/layout.tsx` | Solver role guard + AppShell wrapper |
| `src/hooks/use-solver.ts` | 8 TanStack Query hooks (4 queries + 4 mutations) |
| `src/app/solver/projects/page.tsx` | Browse OPEN projects table |
| `src/app/solver/projects/[id]/page.tsx` | Project detail: bid form, task management, ZIP upload |
| `src/app/solver/requests/page.tsx` | Bid status tracking cards |
| `src/app/solver/profile/page.tsx` | Profile editor (bio + skills) |

Files modified:
| File | Change |
|------|--------|
| `src/hooks/use-auth.ts` | Solver redirect: login → `/solver/projects` |

**Bug fix — ZIP upload "[object Object]" error:**
Two issues caused toast to show "[object Object]" instead of error message:
1. `api-client.ts` always set `Content-Type: application/json` even for FormData.
   Browser must set `Content-Type` for multipart/form-data (includes boundary).
   Fixed: added `isFormData` check to skip Content-Type for FormData uploads.
2. `use-solver.ts` error handler passed FastAPI's `{detail: [{msg: "...", loc: [...]}]}`
   array directly to `new Error()` which stringifies as "[object Object]".
   Fixed: handle both string and array `detail` formats from FastAPI.

---

### ✅ STAGE 10f — UI/UX Animations & Role Theming (COMPLETE)

Goal: Clear role distinction, lifecycle visualization, smooth animated transitions, micro-interactions.

```
PDF Spec Requirements (Must Criteria):
  ① Clear visual distinction between user roles
  ② Step-by-step project lifecycle visualization
  ③ Smooth animated transitions between states
  ④ Use animations to explain system state

Animation Architecture:

  New Foundation Components:
  ┌─────────────────────────────────────────────────────────────────┐
  │ components/lifecycle-stepper.tsx                                 │
  │   Visual progress indicator for state machines                  │
  │   PROJECT: ①Open ──→ ②Assigned ──→ ③Completed                  │
  │   TASK:    ①In Progress ──→ ②Submitted ──→ ③Completed          │
  │   + REVISION_REQUESTED shown as rework loop badge               │
  │   Animations: scale-in circles, pulse on current, progress fill │
  │                                                                 │
  │ components/animated-list.tsx                                     │
  │   Reusable stagger wrapper (Framer Motion)                      │
  │   Parent: staggerChildren: 50ms delay                           │
  │   Child: fade-in (opacity 0→1) + slide-up (y: 15→0)            │
  │   Used on: all list views, table rows, card grids               │
  └─────────────────────────────────────────────────────────────────┘

  Role Theming:
  ┌─────────────────────────────────────────────────────────────────┐
  │ globals.css — CSS variables per role                             │
  │   [data-role="ADMIN"] → red accent (--role-accent: 0 84.2% 60.2%)│
  │   [data-role="BUYER"] → blue accent (--role-accent: 221.2 83% 53%)│
  │   [data-role="SOLVER"]→ green accent (--role-accent: 142.1 76% 36%)│
  │                                                                 │
  │ app-shell.tsx — Role-colored sidebar border                     │
  │   ADMIN: red left border                                        │
  │   BUYER: blue left border                                       │
  │   SOLVER: green left border                                     │
  │   + Sliding nav pill (Framer Motion layoutId)                   │
  │   + Hover micro-interaction on nav links (x: 4)                 │
  │   + whileTap on Sign Out button (scale: 0.97)                  │
  └─────────────────────────────────────────────────────────────────┘

  Page-Level Animations Applied (8 pages):
  ┌─────────────────────────────────────────────────────────────────┐
  │ Buyer pages:                                                    │
  │   buyer/projects/page.tsx      — Staggered table rows           │
  │   buyer/projects/new/page.tsx  — Submit button animation        │
  │   buyer/projects/[id]/page.tsx — Lifecycle stepper, staggered   │
  │                                  lists, AnimatePresence for     │
  │                                  task expand/collapse            │
  │                                                                 │
  │ Solver pages:                                                   │
  │   solver/projects/page.tsx     — Staggered table rows           │
  │   solver/projects/[id]/page.tsx— Lifecycle stepper, staggered   │
  │                                  tasks, AnimatePresence expand,  │
  │                                  bid button animation            │
  │   solver/requests/page.tsx     — Staggered request cards        │
  │   solver/profile/page.tsx      — Save button animation          │
  │                                                                 │
  │ Admin pages:                                                    │
  │   admin/users/page.tsx         — Staggered table rows           │
  │   admin/projects/page.tsx      — Staggered table rows           │
  └─────────────────────────────────────────────────────────────────┘

  Accessibility:
  ┌─────────────────────────────────────────────────────────────────┐
  │ @media (prefers-reduced-motion: reduce)                         │
  │   All animations/transitions set to 0.01ms                      │
  │   Scroll behavior set to auto (no smooth scroll)                │
  │   Users who prefer reduced motion get instant transitions       │
  └─────────────────────────────────────────────────────────────────┘
```

Animation timing standards:
| Type | Duration | Use |
|------|----------|-----|
| Micro-interaction (hover/tap) | 150ms | Buttons, links |
| List stagger delay | 50ms | Between items |
| Content transition | 300ms | Expand/collapse, tabs |
| Page entrance | 300ms | Already in app-shell |
| Stepper progress | 600ms | Lifecycle stepper fill |

Files created:
| File | Purpose |
|------|---------|
| `src/components/lifecycle-stepper.tsx` | Visual state machine progress (project + task variants) |
| `src/components/animated-list.tsx` | Reusable staggered list wrapper (AnimatedList + AnimatedListItem) |

Files modified:
| File | Change |
|------|--------|
| `src/app/globals.css` | Role accent CSS variables + prefers-reduced-motion |
| `src/components/app-shell.tsx` | Role-colored sidebar border, sliding nav pill, hover/tap animations |
| `src/app/buyer/projects/page.tsx` | Staggered rows, "New Project" button animation |
| `src/app/buyer/projects/new/page.tsx` | Submit button hover/tap animation |
| `src/app/buyer/projects/[id]/page.tsx` | Lifecycle stepper, staggered lists, AnimatePresence expand/collapse |
| `src/app/solver/projects/page.tsx` | Staggered table rows |
| `src/app/solver/projects/[id]/page.tsx` | Lifecycle stepper, staggered tasks, AnimatePresence, bid animation |
| `src/app/solver/requests/page.tsx` | Staggered request cards |
| `src/app/solver/profile/page.tsx` | Save button hover/tap animation |
| `src/app/admin/users/page.tsx` | Staggered table rows |
| `src/app/admin/projects/page.tsx` | Staggered table rows |

---

## State Machine Reference

```
PROJECT:   OPEN ──────► ASSIGNED ──────► COMPLETED
                (accept     │        (all tasks done)
                request)    │
                            │
TASK:      IN_PROGRESS ──► SUBMITTED ──► COMPLETED
                (ZIP upload)  │      (buyer accepts)
                              │
                              └──► REVISION_REQUESTED ──► IN_PROGRESS
                                   (buyer rejects)        (solver reworks)

REQUEST:   PENDING ──► ACCEPTED
                  └──► REJECTED

SUBMISSION: PENDING_REVIEW ──► ACCEPTED
                          └──► REJECTED
```

## Role Access Quick Reference

```
ADMIN  → manage roles, view everything
BUYER  → create projects, review work, accept/reject
SOLVER → browse projects, request work, create tasks, upload ZIPs
```
