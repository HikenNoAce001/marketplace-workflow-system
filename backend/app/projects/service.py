# Project service — CRUD with role-based access control.

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
    # Create a new OPEN project.
    project = Project(
        title=title,
        description=description,
        budget=budget,
        deadline=deadline,
        buyer_id=buyer.id,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project


async def list_projects(
    session: AsyncSession, user: User, page: int = 1, limit: int = 20,
) -> dict:
    # Role-aware project listing: admin=all, buyer=own, solver=open+assigned.
    if user.role == UserRole.ADMIN:
        where_clause = True  # noqa: E712
    elif user.role == UserRole.BUYER:
        where_clause = Project.buyer_id == user.id
    else:
        where_clause = or_(
            Project.status == ProjectStatus.OPEN,
            Project.assigned_solver_id == user.id,
        )

    count_stmt = select(func.count()).select_from(Project).where(where_clause)
    total = (await session.exec(count_stmt)).one()

    offset = (page - 1) * limit
    stmt = (
        select(Project)
        .where(where_clause)
        .offset(offset)
        .limit(limit)
        .order_by(Project.created_at.desc())
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
    # Get a single project with role-based access check.
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:
        if project.status != ProjectStatus.OPEN and project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this project")

    return project


async def update_project(
    session: AsyncSession, project_id: UUID, buyer: User,
    title: str | None = None, description: str | None = None,
    budget=None, deadline=None,
) -> Project:
    # Update a project. Only owner can edit, only while OPEN.
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.buyer_id != buyer.id:
        raise HTTPException(status_code=403, detail="Not your project")

    if project.status != ProjectStatus.OPEN:
        raise HTTPException(status_code=400, detail="Can only update OPEN projects")

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
