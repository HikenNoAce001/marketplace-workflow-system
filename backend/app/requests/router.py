"""
Request Router — HTTP endpoints for the bidding system.

Endpoints:
  POST  /api/projects/{id}/requests       → Solver bids on a project
  GET   /api/projects/{id}/requests       → Buyer views bids on their project
  GET   /api/requests/me                  → Solver views their own bids
  PATCH /api/requests/{id}/accept         → Buyer accepts a bid (CASCADE)
  PATCH /api/requests/{id}/reject         → Buyer rejects a bid
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.requests import service
from app.requests.schemas import RequestCreate, RequestListResponse, RequestRead

router = APIRouter(tags=["requests"])


def _to_read(r) -> RequestRead:
    """Convert ProjectRequest model → RequestRead schema."""
    return RequestRead(
        id=r.id, project_id=r.project_id, solver_id=r.solver_id,
        cover_letter=r.cover_letter, status=r.status.value,
        created_at=r.created_at, updated_at=r.updated_at,
    )


# ---------------------------------------------------------------------------
# Solver endpoints
# ---------------------------------------------------------------------------

@router.post("/api/projects/{project_id}/requests", response_model=RequestRead, status_code=201)
async def create_request(
    project_id: UUID,
    body: RequestCreate,
    current_user: User = Depends(require_role(UserRole.SOLVER)),  # Only solvers can bid
    session: AsyncSession = Depends(get_session),
):
    """Solver requests to work on a project. One bid per solver per project."""
    request = await service.create_request(session, current_user, project_id, body.cover_letter)
    return _to_read(request)


@router.get("/api/requests/me", response_model=RequestListResponse)
async def list_my_requests(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_role(UserRole.SOLVER)),  # Solver views their own bids
    session: AsyncSession = Depends(get_session),
):
    """Solver views all their bids across all projects."""
    result = await service.list_my_requests(session, current_user, page, limit)
    return RequestListResponse(
        data=[_to_read(r) for r in result["data"]],
        meta=result["meta"],
    )


# ---------------------------------------------------------------------------
# Buyer endpoints
# ---------------------------------------------------------------------------

@router.get("/api/projects/{project_id}/requests", response_model=RequestListResponse)
async def list_project_requests(
    project_id: UUID,
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_role(UserRole.BUYER)),  # Buyer views bids on their project
    session: AsyncSession = Depends(get_session),
):
    """Buyer views all bids on their project."""
    result = await service.list_requests_for_project(
        session, project_id, current_user, page, limit,
    )
    return RequestListResponse(
        data=[_to_read(r) for r in result["data"]],
        meta=result["meta"],
    )


@router.patch("/api/requests/{request_id}/accept", response_model=RequestRead)
async def accept_request(
    request_id: UUID,
    current_user: User = Depends(require_role(UserRole.BUYER)),  # Only buyer can accept
    session: AsyncSession = Depends(get_session),
):
    """
    Buyer accepts a solver's bid. CASCADE TRANSACTION:
    1. Accept this request
    2. Reject all other PENDING requests
    3. Assign solver to project
    4. Project → ASSIGNED
    """
    request = await service.accept_request(session, request_id, current_user)
    return _to_read(request)


@router.patch("/api/requests/{request_id}/reject", response_model=RequestRead)
async def reject_request(
    request_id: UUID,
    current_user: User = Depends(require_role(UserRole.BUYER)),  # Only buyer can reject
    session: AsyncSession = Depends(get_session),
):
    """Buyer rejects a single bid. No cascade — project stays OPEN."""
    request = await service.reject_request(session, request_id, current_user)
    return _to_read(request)
