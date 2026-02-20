# Request (bid) endpoints — create, list, accept, reject.

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.project import Project
from app.models.user import User, UserRole
from app.requests import service
from app.requests.schemas import RequestCreate, RequestListResponse, RequestRead

router = APIRouter(tags=["requests"])


async def _to_read(r, session: AsyncSession) -> RequestRead:
    # Convert ProjectRequest model to response schema with solver name and project title.
    solver = await session.get(User, r.solver_id)
    solver_name = solver.name if solver else "Unknown"
    project = await session.get(Project, r.project_id)
    project_title = project.title if project else "Unknown"

    return RequestRead(
        id=r.id, project_id=r.project_id, solver_id=r.solver_id,
        cover_letter=r.cover_letter, status=r.status.value,
        created_at=r.created_at, updated_at=r.updated_at,
        solver_name=solver_name, project_title=project_title,
    )


@router.post("/api/projects/{project_id}/requests", response_model=RequestRead, status_code=201)
async def create_request(
    project_id: UUID,
    body: RequestCreate,
    current_user: User = Depends(require_role(UserRole.SOLVER)),
    session: AsyncSession = Depends(get_session),
):
    # Solver bids on a project.
    request = await service.create_request(session, current_user, project_id, body.cover_letter)
    return await _to_read(request, session)


@router.get("/api/requests/me", response_model=RequestListResponse)
async def list_my_requests(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_role(UserRole.SOLVER)),
    session: AsyncSession = Depends(get_session),
):
    # Solver views all their bids.
    result = await service.list_my_requests(session, current_user, page, limit)
    return RequestListResponse(
        data=[await _to_read(r, session) for r in result["data"]],
        meta=result["meta"],
    )


@router.get("/api/projects/{project_id}/requests", response_model=RequestListResponse)
async def list_project_requests(
    project_id: UUID,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Buyer views bids on their project.
    result = await service.list_requests_for_project(
        session, project_id, current_user, page, limit,
    )
    return RequestListResponse(
        data=[await _to_read(r, session) for r in result["data"]],
        meta=result["meta"],
    )


@router.patch("/api/requests/{request_id}/accept", response_model=RequestRead)
async def accept_request(
    request_id: UUID,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Accept a bid. Cascades: reject others, assign solver, project to ASSIGNED.
    request = await service.accept_request(session, request_id, current_user)
    return await _to_read(request, session)


@router.patch("/api/requests/{request_id}/reject", response_model=RequestRead)
async def reject_request(
    request_id: UUID,
    current_user: User = Depends(require_role(UserRole.BUYER)),
    session: AsyncSession = Depends(get_session),
):
    # Reject a single bid.
    request = await service.reject_request(session, request_id, current_user)
    return await _to_read(request, session)
