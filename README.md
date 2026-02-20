<div align="center">

# Marketplace Workflow System

**A full-stack project marketplace with role-based access, real-time bidding, and ZIP deliverable management.**

Built with **FastAPI** + **Next.js 16** + **PostgreSQL** + **MinIO**

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.129-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.1-000000?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
│                     Next.js 16 + React 19                       │
│              TanStack Query ← Zustand (auth state)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ fetch + JWT Bearer
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (async)                       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   Auth   │  │ Projects │  │ Requests │  │  Submissions     │ │
│  │  (JWT)   │  │  (CRUD)  │  │  (Bids)  │  │  (ZIP + Review)  │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘ │
│       │              │              │                │            │
│       ▼              ▼              ▼                ▼            │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐   │
│  │     SQLModel + asyncpg      │  │    MinIO (S3-compat)     │   │
│  │       (PostgreSQL 16)       │  │   presigned URL upload   │   │
│  └─────────────────────────────┘  └──────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Browser ──► Next.js App ──► fetch wrapper (auto token refresh)
                                    │
                                    ▼
                            FastAPI endpoint
                                    │
                            ┌───────┴───────┐
                            ▼               ▼
                     Role guard        Service layer
                   (dependency)      (business logic)
                                          │
                                    ┌─────┴─────┐
                                    ▼           ▼
                               PostgreSQL    MinIO
                              (via asyncpg) (presigned URLs)
```

### Auth Flow

```
Login ──► POST /auth/dev-login ──► JWT access token (15min, in memory)
                                 + refresh token (7d, httpOnly cookie)

API call ──► Bearer token in header ──► 401? ──► auto-refresh ──► retry
                                                      │
                                               refresh fails? ──► logout
```

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

### State Machines

```
Project:     OPEN ──────► ASSIGNED ──────► COMPLETED
                (bid accepted)     (all tasks done)

Task:        IN_PROGRESS ──► SUBMITTED ──► COMPLETED
                  ▲         (ZIP uploaded)  (accepted)
                  │               │
                  │               ▼
                  └──── REVISION_REQUESTED
                         (rejected — rework cycle)

Request:     PENDING ──► ACCEPTED | REJECTED

Submission:  PENDING_REVIEW ──► ACCEPTED | REJECTED
```

### Cascade Rules (single DB transaction each)

1. **Accept bid** → reject all other pending bids → assign solver → project ASSIGNED
2. **Upload ZIP** → create submission (PENDING_REVIEW) → task SUBMITTED
3. **Accept submission** → task COMPLETED → if all tasks done → project COMPLETED

---

## Tech Stack

| Layer          | Technology                                          |
| -------------- | --------------------------------------------------- |
| **API**        | Python 3.12, FastAPI 0.129, async/await throughout  |
| **ORM**        | SQLModel (SQLAlchemy 2.0 + Pydantic v2 in one)      |
| **Database**   | PostgreSQL 16 via asyncpg                           |
| **Migrations** | Alembic (auto-generated from models)                |
| **Storage**    | MinIO (S3-compatible, presigned URLs)               |
| **Auth**       | PyJWT — 15min access token, 7-day refresh cookie    |
| **Frontend**   | Next.js 16.1 (App Router, Turbopack)                |
| **UI**         | React 19, TypeScript strict, Tailwind + shadcn/ui   |
| **Data**       | TanStack Query v5 (server state), Zustand (auth)    |
| **Animation**  | Framer Motion                                       |
| **Infra**      | Docker Compose, Railway                             |

---

## Quick Start

### One Command Setup

```bash
git clone https://github.com/YOUR_USERNAME/project-workflow-system.git
cd project-workflow-system
./setup.sh
```

The script checks prerequisites, builds Docker containers, runs migrations, seeds test users, installs frontend dependencies, and starts the dev server.

### Manual Setup

```bash
cp .env.example .env
docker compose up --build -d
cd frontend && npm install && npm run dev
```

The backend container automatically runs migrations and seeds test users on startup.

### Services

| Service          | URL                        |
| ---------------- | -------------------------- |
| **Frontend**     | http://localhost:3000       |
| **Backend API**  | http://localhost:8000/api   |
| **Swagger UI**   | http://localhost:8000/docs  |
| **MinIO Console**| http://localhost:9001       |

### Test Users

| Email           | Role   | Login Method |
| --------------- | ------ | ------------ |
| admin@test.com  | ADMIN  | dev-login    |
| buyer@test.com  | BUYER  | dev-login    |
| solver@test.com | SOLVER | dev-login    |

Select any user on the login page to sign in instantly.

### Make Commands

```bash
make up          # Start Docker services
make down        # Stop Docker services
make build       # Rebuild containers
make migrate     # Run Alembic migrations
make seed        # Seed test users
make test-flow   # Run automated E2E workflow test
make logs        # Tail backend logs
make front       # Start Next.js dev server
```

---

## API Routes

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

### 1. SQLModel over Prisma

Prisma Client Python is unmaintained. SQLModel combines SQLAlchemy's ORM with Pydantic validation in a single class — one model serves as both the database table and the API schema base. Migrations are handled by Alembic with autogenerate.

### 2. Custom fetch wrapper over Axios

Native `fetch` integrates with Next.js 16's caching and revalidation. The wrapper handles automatic token refresh on 401 responses in ~40 lines — no need for a full HTTP library dependency.

### 3. Access token in memory only

The access token lives in Zustand (JS memory) and never touches localStorage or sessionStorage. The refresh token is stored in an httpOnly cookie. This prevents XSS from stealing tokens.

### 4. Atomic cascade operations

When a buyer accepts a bid, three things happen in a single database transaction: the bid is accepted, all other bids are rejected, and the project status changes to ASSIGNED. If any step fails, everything rolls back. Same pattern for submission acceptance.

### 5. Presigned URLs for file downloads

MinIO provides S3-compatible storage with presigned URLs. The backend never proxies file downloads — it generates a time-limited URL and the browser downloads directly from MinIO. This keeps the backend stateless and scalable.

### 6. Four-layer ZIP validation

Extension check, MIME type check, `zipfile.is_zipfile()` (handles all ZIP variants including empty and spanned archives), and file size limit. Magic byte detection alone would miss valid edge cases.

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
