"""
Project Router — HTTP endpoints for project CRUD.

Endpoints:
  POST  /api/projects          → Create project (BUYER only)
  GET   /api/projects          → List projects (role-aware)
  GET   /api/projects/{id}     → Get single project (role-aware)
  PATCH /api/projects/{id}     → Update project (BUYER, own OPEN projects only)
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.projects import service
from app.projects.schemas import (
    ProjectCreate,
    ProjectListResponse,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _to_read(p) -> ProjectRead:
    """Helper to convert a Project model to ProjectRead schema."""
    return ProjectRead(
        id=p.id, title=p.title, description=p.description,
        budget=p.budget, deadline=p.deadline, status=p.status.value,
        buyer_id=p.buyer_id, assigned_solver_id=p.assigned_solver_id,
        created_at=p.created_at, updated_at=p.updated_at,
    )


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(require_role(UserRole.BUYER)),  # Only buyers create projects
    session: AsyncSession = Depends(get_session),
):
    """Create a new project. BUYER only. Starts as OPEN."""
    project = await service.create_project(
        session, current_user, body.title, body.description, body.budget, body.deadline,
    )
    return _to_read(project)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),  # Any authenticated user (role-filtered in service)
    session: AsyncSession = Depends(get_session),
):
    """List projects. What you see depends on your role."""
    result = await service.list_projects(session, current_user, page, limit)
    return ProjectListResponse(
        data=[_to_read(p) for p in result["data"]],
        meta=result["meta"],
    )


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),  # Any authenticated, access checked in service
    session: AsyncSession = Depends(get_session),
):
    """Get a single project by ID. Access rules enforced in service layer."""
    project = await service.get_project_by_id(session, project_id, current_user)
    return _to_read(project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    current_user: User = Depends(require_role(UserRole.BUYER)),  # Only buyers edit projects
    session: AsyncSession = Depends(get_session),
):
    """Update a project. BUYER only, own OPEN projects only."""
    project = await service.update_project(
        session, project_id, current_user,
        body.title, body.description, body.budget, body.deadline,
    )
    return _to_read(project)
