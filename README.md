# Marketplace Project Workflow System

A role-based project marketplace where Buyers post projects, Solvers bid and deliver work as ZIP files, and Admins manage the platform. Built with FastAPI + Next.js 16.

**Live Demo:** [Railway deployment URL](https://marketplace-workflow-system.up.railway.app/)

---

## System Overview

### Role Hierarchy

| Role       | Access                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------- |
| **Admin**  | Manage user roles, view all users/projects. Seeded only (not self-registered).                     |
| **Buyer**  | Create projects, review bids, accept/reject task submissions.                                      |
| **Solver** | Browse projects, submit bids, create tasks, upload ZIP deliverables. Default role on registration. |

### Project Lifecycle

```
Buyer creates project (OPEN)
        │
        ▼
Solvers submit bids (requests)
        │
        ▼
Buyer accepts one bid ──► Project becomes ASSIGNED
  (other bids auto-rejected)    Solver starts working
        │
        ▼
Solver creates tasks, uploads ZIPs per task
        │
        ▼
Buyer reviews each submission (accept/reject)
        │
        ▼
All tasks accepted ──► Project auto-completes (COMPLETED)
```

### State Transitions

**Project:** `OPEN → ASSIGNED → COMPLETED`

**Task:** `IN_PROGRESS → SUBMITTED → COMPLETED`

- Rejection triggers: `SUBMITTED → REVISION_REQUESTED → SUBMITTED` (rework cycle)

**Request (Bid):** `PENDING → ACCEPTED | REJECTED`

**Submission:** `PENDING_REVIEW → ACCEPTED | REJECTED`

### Cascade Rules (single DB transaction each)

1. **Accept bid** → reject all other pending bids → assign solver → project ASSIGNED
2. **Upload ZIP** → create submission (PENDING_REVIEW) → task SUBMITTED
3. **Accept submission** → task COMPLETED → if all tasks done → project COMPLETED

---

## Tech Stack

### Backend

- **Python 3.12** / **FastAPI 0.129** — async REST API
- **SQLModel** (SQLAlchemy 2.0 + Pydantic v2) — ORM + validation in one class
- **PostgreSQL 16** via asyncpg — async driver
- **Alembic** — database migrations auto-generated from models
- **MinIO** — S3-compatible object storage for ZIP uploads
- **PyJWT** — JWT auth (15min access token, 7-day refresh in httpOnly cookie)

### Frontend

- **Next.js 16.1** (App Router, Turbopack)
- **React 19** / **TypeScript** strict mode
- **Tailwind CSS** + **shadcn/ui** — component library
- **TanStack Query v5** — server state management
- **Zustand** — client state (auth token in memory only)
- **Framer Motion** — animations and transitions

### Infrastructure

- **Docker Compose** — PostgreSQL, MinIO, backend, frontend
- **Railway** — production deployment

---

## Setup Instructions

### Prerequisites

- Docker & Docker Compose
- Node.js 20.9+ (for local frontend dev)
- Python 3.12+ (optional, for running outside Docker)

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/project-workflow-system.git
cd project-workflow-system

# 2. Create .env from the example
cp .env.example .env

# 3. Start all services (PostgreSQL, MinIO, backend)
make up

# 4. Run database migrations
make migrate

# 5. Seed test users
make seed

# 6. Start frontend dev server
cd frontend && npm install && npm run dev
```

The app will be running at:

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Swagger UI:** http://localhost:8000/docs
- **MinIO Console:** http://localhost:9001

### Test Users

| Email           | Role   | Password                |
| --------------- | ------ | ----------------------- |
| admin@test.com  | ADMIN  | dev-login (no password) |
| buyer@test.com  | BUYER  | dev-login               |
| solver@test.com | SOLVER | dev-login               |

Login via `POST /api/auth/dev-login` with `{"email": "buyer@test.com"}` or use the frontend login page.

### Useful Commands

```bash
make up          # Start Docker services
make down        # Stop Docker services
make build       # Rebuild containers
make migrate     # Run Alembic migrations
make seed        # Seed test users
make test-flow   # Run automated E2E workflow test
make logs        # Tail backend logs
make front       # Start Next.js dev server
make front-build # Production build of frontend
```

---

## API Route Summary

### Auth

| Method | Route                 | Description             | Access        |
| ------ | --------------------- | ----------------------- | ------------- |
| POST   | `/api/auth/dev-login` | Get token for test user | Public        |
| GET    | `/api/auth/me`        | Get current user        | Authenticated |
| POST   | `/api/auth/refresh`   | Refresh access token    | Cookie        |
| POST   | `/api/auth/logout`    | Clear refresh cookie    | Authenticated |

### Users

| Method | Route                   | Description        | Access |
| ------ | ----------------------- | ------------------ | ------ |
| GET    | `/api/users`            | List all users     | Admin  |
| PATCH  | `/api/users/{id}/role`  | Change user role   | Admin  |
| GET    | `/api/users/me/profile` | Get solver profile | Solver |
| PATCH  | `/api/users/me/profile` | Update bio/skills  | Solver |

### Projects

| Method | Route                    | Description                   | Access        |
| ------ | ------------------------ | ----------------------------- | ------------- |
| POST   | `/api/projects`          | Create project                | Buyer         |
| GET    | `/api/projects`          | List projects (role-filtered) | Authenticated |
| GET    | `/api/projects/{id}`     | Get project details           | Authenticated |
| GET    | `/api/projects/assigned` | Solver's assigned projects    | Solver        |

### Requests (Bids)

| Method | Route                         | Description           | Access      |
| ------ | ----------------------------- | --------------------- | ----------- |
| POST   | `/api/projects/{id}/requests` | Submit bid            | Solver      |
| GET    | `/api/projects/{id}/requests` | List bids for project | Buyer/Admin |
| GET    | `/api/requests/me`            | Solver's own bids     | Solver      |
| PATCH  | `/api/requests/{id}/accept`   | Accept bid (cascade)  | Buyer       |
| PATCH  | `/api/requests/{id}/reject`   | Reject bid            | Buyer       |

### Tasks

| Method | Route                      | Description        | Access          |
| ------ | -------------------------- | ------------------ | --------------- |
| POST   | `/api/projects/{id}/tasks` | Create task        | Assigned Solver |
| GET    | `/api/projects/{id}/tasks` | List project tasks | Buyer/Solver    |

### Submissions

| Method | Route                            | Description          | Access          |
| ------ | -------------------------------- | -------------------- | --------------- |
| POST   | `/api/tasks/{id}/submissions`    | Upload ZIP           | Assigned Solver |
| GET    | `/api/tasks/{id}/submissions`    | List submissions     | Buyer/Solver    |
| GET    | `/api/submissions/{id}/download` | Get download URL     | Buyer/Solver    |
| PATCH  | `/api/submissions/{id}/accept`   | Accept (cascade)     | Buyer           |
| PATCH  | `/api/submissions/{id}/reject`   | Reject with feedback | Buyer           |

---

## Key Architectural Decisions

### 1. SQLModel instead of Prisma

Prisma Client Python is unmaintained. SQLModel combines SQLAlchemy's ORM with Pydantic validation in a single class definition — one model serves as both the DB table and the API schema base.

### 2. Custom fetch wrapper instead of Axios

Native `fetch` integrates with Next.js 16's caching and revalidation. The wrapper handles token refresh automatically on 401 responses — about 40 lines of code vs pulling in a full HTTP library.

### 3. Access token in memory only

The access token lives in Zustand (JS memory) and never touches localStorage. Refresh token is in an httpOnly cookie. This prevents XSS from stealing tokens — even if an attacker injects scripts, they can't read the access token from memory of a different closure.

### 4. Cascade operations in single transactions

When a buyer accepts a bid, three things happen atomically: the bid is accepted, all other bids are rejected, and the project is assigned. If any step fails, everything rolls back. Same pattern for submission acceptance (task complete → maybe project complete).

### 5. MinIO for file storage

Backend containers are stateless — files can't live on the filesystem. MinIO provides S3-compatible storage with presigned URLs, so the backend never proxies file downloads. The frontend downloads directly from MinIO.

### 6. ZIP validation with 4 checks

Extension, MIME type, `zipfile.is_zipfile()` (handles all ZIP variants including empty/spanned archives), and size limit. Magic byte check alone would miss valid edge cases.

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, lifespan
│   ├── config.py             # Environment settings
│   ├── database.py           # Async engine + session factory
│   ├── dependencies.py       # Auth + role guards
│   ├── models/               # SQLModel table definitions
│   ├── auth/                 # JWT + dev-login
│   ├── users/                # User management + profiles
│   ├── projects/             # CRUD + role-filtered queries
│   ├── requests/             # Bid system with cascade accept
│   ├── tasks/                # Task CRUD under projects
│   ├── submissions/          # ZIP upload + review workflow
│   └── storage/              # MinIO operations
├── alembic/                  # Migration versions
└── scripts/
    ├── seed.py               # Test user seeder
    └── test_workflow.py      # E2E automated test

frontend/src/
├── app/                      # Next.js App Router pages
│   ├── auth/                 # Login page
│   ├── dashboard/            # Role-based dashboard
│   ├── admin/                # User + project management
│   ├── buyer/                # Project creation + review
│   └── solver/               # Browse, bid, deliver
├── components/               # Shared UI components
├── hooks/                    # TanStack Query hooks per module
├── stores/                   # Zustand auth store
├── lib/                      # API client + utilities
└── types/                    # TypeScript interfaces
```
