"""
Request Service — business logic for solver bidding on projects.

This module contains the FIRST cascade transaction:
  accept_request() → in ONE transaction:
    1. Accept this request
    2. Reject all other PENDING requests for the same project
    3. Assign solver to project
    4. Set project status to ASSIGNED

If ANY step fails, everything rolls back. No partial state.
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.project import Project, ProjectStatus
from app.models.request import ProjectRequest, RequestStatus
from app.models.user import User, UserRole


async def create_request(
    session: AsyncSession, solver: User, project_id: UUID, cover_letter: str,
) -> ProjectRequest:
    """
    Solver requests to work on a project. Rules:
    1. Project must exist
    2. Project must be OPEN (can't bid on assigned/completed projects)
    3. Solver can't bid on their own project (edge case if they're also a buyer — not possible per roles)
    4. One bid per solver per project (enforced by DB unique constraint)
    """
    # Check project exists and is OPEN
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=400, detail="Project is not open for requests")

    # Check solver hasn't already requested this project
    # The DB unique constraint (project_id, solver_id) would catch this,
    # but we check first for a better error message
    stmt = select(ProjectRequest).where(
        ProjectRequest.project_id == project_id,
        ProjectRequest.solver_id == solver.id,
    )
    result = await session.exec(stmt)
    if result.first():
        raise HTTPException(status_code=400, detail="You already requested this project")

    # Create the request
    request = ProjectRequest(
        project_id=project_id,
        solver_id=solver.id,
        cover_letter=cover_letter,
    )
    session.add(request)
    await session.commit()
    await session.refresh(request)
    return request


async def list_requests_for_project(
    session: AsyncSession, project_id: UUID, buyer: User,
    page: int = 1, limit: int = 20,
) -> dict:
    """
    List all requests for a project. BUYER only (must own the project).
    Shows the buyer who wants to work on their project.
    """
    # Verify the buyer owns this project
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Count + fetch
    count_stmt = select(func.count()).select_from(ProjectRequest).where(
        ProjectRequest.project_id == project_id,
    )
    total = (await session.exec(count_stmt)).one()

    offset = (page - 1) * limit
    stmt = (
        select(ProjectRequest)
        .where(ProjectRequest.project_id == project_id)
        .offset(offset)
        .limit(limit)
        .order_by(ProjectRequest.created_at.desc())
    )
    result = await session.exec(stmt)
    requests = result.all()

    return {
        "data": requests,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 0,
        },
    }


async def list_my_requests(
    session: AsyncSession, solver: User, page: int = 1, limit: int = 20,
) -> dict:
    """
    List all requests made by the current solver.
    So the solver can see which projects they've bid on and the status.
    """
    count_stmt = select(func.count()).select_from(ProjectRequest).where(
        ProjectRequest.solver_id == solver.id,
    )
    total = (await session.exec(count_stmt)).one()

    offset = (page - 1) * limit
    stmt = (
        select(ProjectRequest)
        .where(ProjectRequest.solver_id == solver.id)
        .offset(offset)
        .limit(limit)
        .order_by(ProjectRequest.created_at.desc())
    )
    result = await session.exec(stmt)
    requests = result.all()

    return {
        "data": requests,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 0,
        },
    }


# ---------------------------------------------------------------------------
# CASCADE: accept_request
#
# This is a CRITICAL transaction. Everything happens atomically:
#   1. Accept this request         → request.status = ACCEPTED
#   2. Reject all other PENDING    → bulk update
#   3. Assign solver to project    → project.assigned_solver_id = solver
#   4. Project → ASSIGNED          → project.status = ASSIGNED
#
# If step 3 fails, steps 1-2 are rolled back. No orphan state.
# ---------------------------------------------------------------------------

async def accept_request(
    session: AsyncSession, request_id: UUID, buyer: User,
) -> ProjectRequest:
    """
    Buyer accepts a solver's request. CASCADES in one transaction.

    Why one transaction?
    Imagine step 2 succeeds (reject others) but step 3 fails (assign solver).
    Now all other requests are rejected, but no solver is assigned.
    The project is stuck — no one can work on it. That's why we need atomicity.
    """
    # Load the request
    request = await session.get(ProjectRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    # Must be PENDING — can't accept an already accepted/rejected request
    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")

    # Load the project — verify buyer owns it
    project = await session.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Project must be OPEN — can't accept requests on assigned/completed projects
    if project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=400, detail="Project is not open")

    # === CASCADE START ===
    # All steps happen in the same transaction (provided by get_session dependency).
    # If any step fails, the whole request errors and nothing is committed.

    # Step 1: Accept this request
    request.status = RequestStatus.ACCEPTED
    request.updated_at = datetime.now(timezone.utc)

    # Step 2: Reject ALL other PENDING requests for the same project
    # Uses bulk update — much faster than loading each one individually
    reject_stmt = (
        update(ProjectRequest)
        .where(
            ProjectRequest.project_id == request.project_id,
            ProjectRequest.id != request_id,  # Not the one we're accepting
            ProjectRequest.status == RequestStatus.PENDING,
        )
        .values(
            status=RequestStatus.REJECTED,
            updated_at=datetime.now(timezone.utc),
        )
    )
    await session.exec(reject_stmt)

    # Step 3: Assign the solver to the project
    project.assigned_solver_id = request.solver_id

    # Step 4: Project status → ASSIGNED
    project.status = ProjectStatus.ASSIGNED
    project.updated_at = datetime.now(timezone.utc)

    # Commit all 4 steps together
    await session.commit()

    # === CASCADE END ===

    await session.refresh(request)
    return request


async def reject_request(
    session: AsyncSession, request_id: UUID, buyer: User,
) -> ProjectRequest:
    """
    Buyer rejects a single request. No cascade — just changes status.
    Project stays OPEN, other requests are unaffected.
    """
    request = await session.get(ProjectRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")

    # Verify buyer owns the project
    project = await session.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Simple status change — no cascade needed
    request.status = RequestStatus.REJECTED
    request.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(request)
    return request
