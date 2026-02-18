"""
Project Service — business logic for project CRUD.

Who can do what:
  - BUYER:  create projects, update own OPEN projects, view own projects
  - SOLVER: view OPEN projects + projects they're assigned to
  - ADMIN:  view all projects

Key rule: projects can only be updated while status is OPEN.
Once ASSIGNED or COMPLETED, the project is locked.
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import func, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.project import Project, ProjectStatus
from app.models.user import User, UserRole


async def create_project(
    session: AsyncSession, buyer: User, title: str, description: str,
    budget=None, deadline=None,
) -> Project:
    """
    Create a new project. Only BUYER can call this (enforced by router).
    Project starts as OPEN — solvers can now request to work on it.
    """
    project = Project(
        title=title,
        description=description,
        budget=budget,
        deadline=deadline,
        buyer_id=buyer.id,  # The buyer who created it — tracked for ownership checks
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def list_projects(
    session: AsyncSession, user: User, page: int = 1, limit: int = 20,
) -> dict:
    """
    Role-aware project listing:
      - ADMIN:  sees ALL projects
      - BUYER:  sees only projects they created (buyer_id = user.id)
      - SOLVER: sees OPEN projects (to browse) + projects assigned to them

    Returns paginated response { data, meta }.
    """
    # Build the WHERE clause based on role
    if user.role == UserRole.ADMIN:
        # Admin sees everything — no filter
        where_clause = True  # noqa: E712
    elif user.role == UserRole.BUYER:
        # Buyer sees only their own projects
        where_clause = Project.buyer_id == user.id
    else:
        # Solver sees: OPEN projects (to browse) OR assigned to them
        where_clause = or_(
            Project.status == ProjectStatus.OPEN,
            Project.assigned_solver_id == user.id,
        )

    # Count total matching projects
    count_stmt = select(func.count()).select_from(Project).where(where_clause)
    total = (await session.exec(count_stmt)).one()

    # Fetch the page
    offset = (page - 1) * limit
    stmt = (
        select(Project)
        .where(where_clause)
        .offset(offset)
        .limit(limit)
        .order_by(Project.created_at.desc())  # Newest first
    )
    result = await session.exec(stmt)
    projects = result.all()

    return {
        "data": projects,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 0,
        },
    }


async def get_project_by_id(session: AsyncSession, project_id: UUID, user: User) -> Project:
    """
    Get a single project. Access rules:
      - ADMIN:  can view any project
      - BUYER:  can view only own projects
      - SOLVER: can view OPEN projects or projects assigned to them
    """
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Access control
    if user.role == UserRole.ADMIN:
        pass  # Admin can view anything
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:  # SOLVER
        if project.status != ProjectStatus.OPEN and project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this project")

    return project


async def update_project(
    session: AsyncSession, project_id: UUID, buyer: User,
    title: str | None = None, description: str | None = None,
    budget=None, deadline=None,
) -> Project:
    """
    Update a project. Rules:
      1. Only the buyer who created it can update
      2. Only OPEN projects can be updated (ASSIGNED/COMPLETED are locked)
      3. Only updates fields that are provided (not None)
    """
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Must be the project owner
    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    # Can only edit OPEN projects — once assigned, it's locked
    if project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=400, detail="Can only update OPEN projects")

    # Apply partial updates — only change fields that were sent
    if title is not None:
        project.title = title
    if description is not None:
        project.description = description
    if budget is not None:
        project.budget = budget
    if deadline is not None:
        project.deadline = deadline

    project.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(project)
    return project
