# Project endpoints — create, list, get, update.

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


async def _to_read(p, session: AsyncSession) -> ProjectRead:
    # Convert Project model to response schema with resolved names.
    buyer = await session.get(User, p.buyer_id)
    buyer_name = buyer.name if buyer else "Unknown"

    solver_name = None
    if p.assigned_solver_id:
        solver = await session.get(User, p.assigned_solver_id)
        solver_name = solver.name if solver else "Unknown"

    return ProjectRead(
        id=p.id, title=p.title, description=p.description,
        budget=p.budget, deadline=p.deadline, status=p.status.value,
        buyer_id=p.buyer_id, assigned_solver_id=p.assigned_solver_id,
        created_at=p.created_at, updated_at=p.updated_at,
        buyer_name=buyer_name,
        assigned_solver_name=solver_name,
    )


@router.post("", response_model=ProjectRead, status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Create a new project. BUYER only.
    project = await service.create_project(
        session, current_user, body.title, body.description, body.budget, body.deadline,
    )
    return await _to_read(project, session)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # List projects. Filtered by role.
    result = await service.list_projects(session, current_user, page, limit)
    return ProjectListResponse(
        data=[await _to_read(p, session) for p in result["data"]],
        meta=result["meta"],
    )


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    # Get a single project by ID.
    project = await service.get_project_by_id(session, project_id, current_user)
    return await _to_read(project, session)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Update a project. BUYER only, own OPEN projects only.
    project = await service.update_project(
        session, project_id, current_user,
        body.title, body.description, body.budget, body.deadline,
    )
    return await _to_read(project, session)
