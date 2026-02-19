# Request service — bidding logic and accept/reject cascades.

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
    # Solver bids on a project. One bid per solver per project.
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=400, detail="Project is not open for requests")

    # check for duplicate bid (also enforced by DB unique constraint)
    stmt = select(ProjectRequest).where(
        ProjectRequest.project_id == project_id,
        ProjectRequest.solver_id == solver.id,
    )
    result = await session.exec(stmt)
    if result.first():
        raise HTTPException(status_code=400, detail="You already requested this project")

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
    # List all bids on a project. Buyer must own the project.
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

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
    # List all bids by the current solver.
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


async def accept_request(
    session: AsyncSession, request_id: UUID, buyer: User,
) -> ProjectRequest:
    # Accept a bid. Reject all other pending bids, assign solver, project to ASSIGNED.
    request = await session.get(ProjectRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")

    project = await session.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")
    if project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=400, detail="Project is not open")

    # accept this request
    request.status = RequestStatus.ACCEPTED
    request.updated_at = datetime.now(timezone.utc)

    # reject all other pending requests for this project
    reject_stmt = (
        update(ProjectRequest)
        .where(
            ProjectRequest.project_id == request.project_id,
            ProjectRequest.id != request_id,
            ProjectRequest.status == RequestStatus.PENDING,
        )
        .values(
            status=RequestStatus.REJECTED,
            updated_at=datetime.now(timezone.utc),
        )
    )
    await session.exec(reject_stmt)

    # assign solver and move project to ASSIGNED
    project.assigned_solver_id = request.solver_id
    project.status = ProjectStatus.ASSIGNED
    project.updated_at = datetime.now(timezone.utc)

    await session.commit()
    await session.refresh(request)
    return request


async def reject_request(
    session: AsyncSession, request_id: UUID, buyer: User,
) -> ProjectRequest:
    # Reject a single bid. No cascade.
    request = await session.get(ProjectRequest, request_id)
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Request is not pending")

    project = await session.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    request.status = RequestStatus.REJECTED
    request.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(request)
    return request
