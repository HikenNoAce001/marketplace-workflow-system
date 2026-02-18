# CLAUDE.md — Marketplace Project Workflow System

## Project Context

Role-based project marketplace. Exactly 3 roles: Admin, Buyer, Problem Solver.
Full lifecycle: project creation → solver bidding → task management → ZIP delivery → buyer review.
Fully containerized with Docker.

This file is the coding standards reference for AI-assisted development. Read REQUIREMENTS.md for the full specification.

---

## Tech Stack (DO NOT DEVIATE — All latest as of Feb 2026)

- **Backend**: Python 3.12+, FastAPI 0.129+, SQLModel 0.0.33+, Alembic, Pydantic v2
- **Database**: PostgreSQL 16 via SQLModel + asyncpg (async driver)
- **Database URL format**: `postgresql+asyncpg://user:pass@host:port/db`
- **Storage**: MinIO (S3-compatible) via `minio` Python package
- **Auth**: OAuth2 (Google + GitHub) + JWT (PyJWT 2.11+). Access 15min in memory, refresh 7d httpOnly cookie
- **Frontend**: Next.js 16.1 (App Router, Turbopack default), React 19.2, TypeScript 5.1+ strict
- **UI**: Tailwind CSS + shadcn/ui + Framer Motion
- **Data Fetching**: TanStack Query v5 + custom fetch wrapper (NO axios)
- **Client State**: Zustand (auth token in memory only)
- **DevOps**: Docker Compose (postgres:16-alpine, minio/minio, backend, frontend)
- **Node.js**: 20.9+ (required by Next.js 16)

---

## CRITICAL: No Prisma, No Axios

### Prisma Client Python is abandoned/unmaintained. We use SQLModel + Alembic.

- SQLModel classes = SQLAlchemy model + Pydantic model in one class
- Alembic handles migrations (`alembic revision --autogenerate`)
- Use asyncpg as the async PostgreSQL driver

### No axios. Use native fetch with a custom wrapper.

- Native fetch integrates with Next.js 16 caching, revalidation, and streaming
- Token refresh interceptor is a thin wrapper (~20 lines) around fetch
- Upload progress: use XMLHttpRequest only where needed for progress events
- The custom fetch wrapper lives in `src/lib/api-client.ts`

---

## Backend Architecture

```
backend/
├── Dockerfile
├── pyproject.toml
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/
├── app/
│   ├── main.py              # App factory, lifespan, CORS, router includes
│   ├── config.py             # Pydantic BaseSettings from .env
│   ├── database.py           # async engine, async session factory
│   ├── dependencies.py       # get_session(), get_current_user(), require_role()
│   ├── models/
│   │   ├── __init__.py       # Import all models (needed for Alembic autogenerate)
│   │   ├── user.py
│   │   ├── project.py
│   │   ├── request.py
│   │   ├── task.py
│   │   ├── submission.py
│   │   └── refresh_token.py
│   ├── auth/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── utils.py
│   ├── users/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── projects/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── requests/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── tasks/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── submissions/
│   │   ├── router.py
│   │   ├── service.py
│   │   └── schemas.py
│   └── storage/
│       └── service.py
├── scripts/
│   └── seed.py
└── tests/
    └── conftest.py
```

## Frontend Architecture

```
frontend/src/
├── app/                      # Next.js 16 App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   ├── dashboard/page.tsx
│   ├── admin/
│   │   ├── users/page.tsx
│   │   └── projects/page.tsx
│   ├── buyer/
│   │   ├── projects/page.tsx
│   │   ├── projects/new/page.tsx
│   │   └── projects/[id]/page.tsx
│   └── solver/
│       ├── profile/page.tsx
│       ├── projects/page.tsx
│       ├── projects/[id]/page.tsx
│       └── requests/page.tsx
├── components/
│   ├── ui/                   # shadcn/ui components
│   └── ...                   # Feature components
├── lib/
│   ├── api-client.ts         # Custom fetch wrapper with token refresh
│   └── utils.ts
├── hooks/
│   └── ...                   # TanStack Query hooks per module
├── stores/
│   └── auth-store.ts         # Zustand — access token in memory only
├── types/
│   └── index.ts              # Shared TypeScript interfaces
└── middleware.ts              # Route protection (check JWT, redirect by role)
```

---

## SQLModel Patterns (FOLLOW EXACTLY)

### Table models go in app/models/

```python
from sqlmodel import SQLModel, Field, Relationship
from uuid import uuid4, UUID
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import String

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    BUYER = "BUYER"
    SOLVER = "SOLVER"

class User(SQLModel, table=True):
    __tablename__ = "users"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(index=True)
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    skills: list[str] = Field(default=[], sa_column=Column(ARRAY(String)))
    provider: str
    provider_id: str
    role: UserRole = Field(default=UserRole.SOLVER)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # relationships...
```

### Request/response schemas go in {module}/schemas.py

```python
from sqlmodel import SQLModel
from uuid import UUID

class UserRead(SQLModel):
    id: UUID
    email: str
    name: str
    avatar_url: str | None = None
    role: str

class UserUpdateProfile(SQLModel):
    bio: str | None = None
    skills: list[str] | None = None
```

### Async session pattern in app/database.py

```python
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
```

---

## Authentication Strategy (explicit — no ambiguity)

### Where tokens live

- **Refresh token**: `httpOnly`, `Secure`, `SameSite=Lax` cookie — 7 day TTL
- **Access token**: returned in JSON body on login/refresh, stored in **Zustand (JS memory only)** — 15 min TTL
- **Access token NEVER touches localStorage or sessionStorage**
- Frontend calls `GET /api/auth/me` on app load to hydrate user identity from access token

### Flow

1. OAuth callback → backend sets refresh cookie + returns `{ access_token }` in body
2. Frontend stores access token in Zustand store (memory)
3. Every API call attaches `Authorization: Bearer <token>` via fetch wrapper
4. On 401 → fetch wrapper calls `POST /api/auth/refresh` (cookie sent automatically) → new access token
5. On refresh failure → clear Zustand, redirect to `/auth/login`

---

## Custom Fetch Wrapper Pattern (frontend/src/lib/api-client.ts)

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const { getToken, setToken, logout } = useAuthStore.getState();

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
      ...options.headers,
    },
    credentials: "include", // sends httpOnly refresh cookie
  });

  if (res.status === 401) {
    const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setToken(data.access_token);
      return fetchWithAuth(url, options); // retry with new token
    }
    logout();
  }

  return res;
}

export const api = {
  get: (url: string) => fetchWithAuth(url),
  post: (url: string, body?: unknown) =>
    fetchWithAuth(url, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: (url: string, body?: unknown) =>
    fetchWithAuth(url, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (url: string) => fetchWithAuth(url, { method: "DELETE" }),
  upload: (url: string, formData: FormData) =>
    fetchWithAuth(url, {
      method: "POST",
      body: formData,
      headers: {}, // Let browser set Content-Type with boundary
    }),
};
```

---

## Roles (EXACTLY 3 — no 4th role, no default/guest)

- **ADMIN**: seeded only, manages user roles, views everything
- **BUYER**: creates projects, reviews work, accepts/rejects submissions
- **SOLVER**: default on OAuth registration, browses projects, bids, creates tasks, submits ZIPs

---

## State Machines (Trimmed to Exact Task PDF)

### Project: OPEN → ASSIGNED → COMPLETED

| From     | To        | Who    | Trigger                   |
| -------- | --------- | ------ | ------------------------- |
| OPEN     | ASSIGNED  | System | Buyer accepts a request   |
| ASSIGNED | COMPLETED | System | All tasks reach COMPLETED |

### Task: IN_PROGRESS → SUBMITTED → COMPLETED

Also: SUBMITTED → REVISION_REQUESTED → IN_PROGRESS (rework cycle)

| From               | To                 | Who    | Trigger            |
| ------------------ | ------------------ | ------ | ------------------ |
| IN_PROGRESS        | SUBMITTED          | System | ZIP uploaded       |
| SUBMITTED          | COMPLETED          | Buyer  | Accepts submission |
| SUBMITTED          | REVISION_REQUESTED | Buyer  | Rejects submission |
| REVISION_REQUESTED | IN_PROGRESS        | Solver | Starts rework      |

Tasks start as IN_PROGRESS on creation (no TODO state — PDF shows no pre-start state).

### Request: PENDING → ACCEPTED | REJECTED

### Auto-Cascade Rules (ALL inside a single DB transaction)

1. **Accept request** → in one transaction: reject all other PENDING → assign solver → project ASSIGNED
2. **Upload submission** → in one transaction: create Submission (PENDING_REVIEW) → task SUBMITTED
3. **Accept submission** → in one transaction: submission ACCEPTED → task COMPLETED → if ALL tasks done → project COMPLETED

---

## Multi-Submission Behavior (explicit rules)

A task can have **multiple submissions** (resubmission after rejection).

1. Solver uploads ZIP → new Submission row with `PENDING_REVIEW` → task → SUBMITTED
2. Only **one submission per task** can be `PENDING_REVIEW` at a time
3. Buyer accepts → submission `ACCEPTED`, task → COMPLETED
4. Buyer rejects with notes → submission `REJECTED`, task → REVISION_REQUESTED
5. Solver reworks → uploads new submission (new row, not update) → task back to SUBMITTED
6. Previous submissions remain as history (never deleted, never modified)
7. `GET /tasks/{id}/submissions` returns all submissions ordered by `submitted_at DESC`

---

## File Upload Validation (ALL checks required)

1. Extension must be `.zip`
2. MIME type must be `application/zip`
3. **Validate using `zipfile.is_zipfile()`** — handles all valid ZIP variants (not just `PK\x03\x04`, also empty archives `PK\x05\x06` and spanned archives `PK\x07\x08`)
4. Size must be ≤ MAX_UPLOAD_SIZE_MB (default 50)
5. Store at: `submissions/{project_id}/{task_id}/{uuid}.zip`
6. Serve via presigned GET URL with 1-hour expiry
7. NEVER serve files directly through the backend

```python
# Correct ZIP validation pattern
import zipfile
import io

async def validate_zip(file_bytes: bytes, filename: str, content_type: str) -> None:
    if not filename.lower().endswith(".zip"):
        raise ValueError("File must have .zip extension")
    if content_type != "application/zip":
        raise ValueError("File must have application/zip MIME type")
    if not zipfile.is_zipfile(io.BytesIO(file_bytes)):
        raise ValueError("File is not a valid ZIP archive")
    if len(file_bytes) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise ValueError(f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")
```

---

## DB Transaction Pattern (CRITICAL for cascades)

All cascade operations MUST happen inside a single database transaction. If any step fails, everything rolls back.

```python
# Correct: single transaction for accept-request cascade
async def accept_request(session: AsyncSession, request_id: UUID, buyer: User):
    async with session.begin():
        # 1. Load and validate request
        request = await session.get(ProjectRequest, request_id)
        # ... validation ...

        # 2. Accept this request
        request.status = RequestStatus.ACCEPTED

        # 3. Reject all other PENDING requests for same project
        stmt = update(ProjectRequest).where(
            ProjectRequest.project_id == request.project_id,
            ProjectRequest.id != request_id,
            ProjectRequest.status == RequestStatus.PENDING,
        ).values(status=RequestStatus.REJECTED)
        await session.exec(stmt)

        # 4. Assign solver to project
        project = await session.get(Project, request.project_id)
        project.assigned_solver_id = request.solver_id
        project.status = ProjectStatus.ASSIGNED

        # All committed together or all rolled back
```

---

## Coding Rules — Backend

### Must Always Do

- Use `async def` for all endpoints and service functions
- Use `AsyncSession` for all DB operations (via asyncpg)
- Use SQLModel `table=True` for DB models, plain SQLModel for request/response schemas
- Set `response_model` on every endpoint
- Use UUID for all primary keys via `uuid4()`
- Validate state transitions in service layer BEFORE executing DB writes
- **Wrap all cascade operations in a single DB transaction** (`async with session.begin()`)
- Use dependency injection: `session: AsyncSession = Depends(get_session)`
- Use dependency injection: `current_user: User = Depends(get_current_user)`
- Return proper HTTP codes: 201 create, 204 delete, 403 forbidden
- Pagination: `page: int = 1, limit: int = 20` → `{ data, meta: { page, limit, total, total_pages } }`
- Keep routers thin — call service functions and return results
- Use Alembic for ALL schema changes (never raw DDL)
- Import all models in `app/models/__init__.py` (required for Alembic autogenerate)

### Must Never Do

- Never use Prisma (abandoned)
- Never use sync DB sessions — always async with asyncpg
- Never put business logic in router.py
- Never hardcode user IDs, roles, or emails
- Never skip state transition validation
- Never return raw SQLModel table instances to the client — map to response schemas
- Never allow requests on non-OPEN projects
- Never allow task creation by non-assigned solvers
- Never serve files through backend — use MinIO presigned URLs only
- Never validate ZIPs with only magic byte check — use `zipfile.is_zipfile()`

---

## Coding Rules — Frontend (Next.js 16.1)

### Must Always Do

- Use App Router only (Turbopack is default in Next.js 16)
- TypeScript strict mode, zero `any` types
- TanStack Query v5 for ALL server state (queries + mutations)
- Zustand ONLY for auth state (access token in memory only)
- Custom fetch wrapper in `src/lib/api-client.ts` for all API calls
- Handle 3 states everywhere: loading (skeleton), error (message + retry), empty (illustration + CTA)
- shadcn/ui as component base, customize with Tailwind
- Framer Motion `AnimatePresence` + `motion.div` for state transitions
- `middleware.ts` for route protection (check JWT, redirect by role)
- Access token in Zustand (memory only), refresh token in httpOnly cookie
- Next.js 16: params and searchParams are async — always `await` them
- Component naming: PascalCase. Files: kebab-case

### Must Never Do

- Never install axios — use the custom fetch wrapper
- Never store tokens in localStorage or sessionStorage
- Never use Pages Router
- Never skip loading/error/empty states
- Never create separate CSS files — Tailwind only
- Never use sync params access (Next.js 16 breaking change)

---

## API Design Conventions

- Base path: `/api`
- Nested resources: `/api/projects/{id}/tasks`, `/api/tasks/{id}/submissions`
- Action endpoints: `/accept`, `/reject` (only what PDF requires)
- Success list: `{ "data": [...], "meta": { "page", "limit", "total", "total_pages" } }`
- Success single: `{ "data": { ... } }`
- Error: `{ "detail": "Human-readable error message" }`
- File upload: multipart/form-data with `file` field + optional `notes` field
- Status codes: 200, 201, 204, 400, 401, 403, 404, 422, 500

---

## Role Access Matrix

| Area                    | ADMIN | BUYER             | SOLVER             |
| ----------------------- | ----- | ----------------- | ------------------ |
| Manage user roles       | ✅    | ❌                | ❌                 |
| View all users/projects | ✅    | ❌                | ❌                 |
| Create projects         | ❌    | ✅                | ❌                 |
| View projects           | All   | Own only          | OPEN + assigned    |
| Request to work         | ❌    | ❌                | ✅                 |
| Accept/reject requests  | ❌    | ✅ (own projects) | ❌                 |
| Create tasks            | ❌    | ❌                | ✅ (assigned only) |
| Submit ZIP              | ❌    | ❌                | ✅ (assigned only) |
| Review submissions      | ❌    | ✅ (own projects) | ❌                 |

---

## Docker Services

```yaml
services:
  postgres: # postgres:16-alpine, port 5432
  minio: # minio/minio, ports 9000 (API) + 9001 (console)
  backend: # build ./backend, port 8000, depends on postgres + minio
  frontend: # build ./frontend, port 3000, depends on backend
```

---

## Migration Commands (Alembic)

```bash
alembic revision --autogenerate -m "description"   # Generate from model changes
alembic upgrade head                                # Apply all migrations
alembic downgrade -1                                # Rollback one step
alembic current                                     # Check current version
alembic history                                     # View migration history
```

---

## Common Mistakes to Avoid

1. Using Prisma (abandoned — use SQLModel + Alembic)
2. Using axios (use native fetch wrapper — integrates with Next.js 16)
3. Using sync DB sessions (must be async with asyncpg)
4. Adding a 4th role — there are EXACTLY 3: ADMIN, BUYER, SOLVER
5. Adding extra statuses not in PDF (no DRAFT, no CANCELLED, no TODO, no IN_PROGRESS for projects)
6. Adding extra endpoints not in PDF (no /start, no /reorder, no /withdraw, no separate /status)
7. Allowing state transitions out of order
8. Forgetting auto-reject when accepting a request
9. Forgetting auto-complete project when all tasks done
10. Running cascades without a DB transaction (use `async with session.begin()`)
11. Letting non-assigned solvers create tasks
12. Accepting requests on non-OPEN projects
13. Validating ZIPs with only magic bytes instead of `zipfile.is_zipfile()`
14. Returning table models directly without response schemas
15. Putting business logic in routers instead of services
16. Using sync params in Next.js 16 (must await)
17. Storing tokens in localStorage
18. Missing loading/error/empty states in UI
19. Not importing all models in `app/models/__init__.py` (breaks Alembic)
20. Allowing multiple PENDING_REVIEW submissions per task (only one at a time)
21. Modifying old submissions instead of creating new rows on resubmission
