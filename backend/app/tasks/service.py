# Task service — create, list, get, update with access control.

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole


async def create_task(
    session: AsyncSession, solver: User, project_id: UUID,
    title: str, description: str, deadline=None,
) -> Task:
    # Create a task on an ASSIGNED project. Only the assigned solver can do this.
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.status != ProjectStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Project must be in ASSIGNED status")

    if project.assigned_solver_id != solver.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this project")

    task = Task(
        project_id=project_id,
        created_by=solver.id,
        title=title,
        description=description,
        deadline=deadline,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return task


async def list_tasks_for_project(
    session: AsyncSession, project_id: UUID, user: User,
    page: int = 1, limit: int = 20,
) -> dict:
    # List tasks for a project with role-based access check.
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    count_stmt = select(func.count()).select_from(Task).where(Task.project_id == project_id)
    total = (await session.exec(count_stmt)).one()

    offset = (page - 1) * limit
    stmt = (
        select(Task)
        .where(Task.project_id == project_id)
        .offset(offset)
        .limit(limit)
        .order_by(Task.created_at.asc())
    )
    result = await session.exec(stmt)
    tasks = result.all()

    return {
        "data": tasks,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 0,
        },
    }


async def get_task_by_id(session: AsyncSession, task_id: UUID, user: User) -> Task:
    # Get a single task with access check via parent project.
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = await session.get(Project, task.project_id)
    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    return task


async def update_task(
    session: AsyncSession, task_id: UUID, solver: User,
    title: str | None = None, description: str | None = None, deadline=None,
) -> Task:
    # Update task metadata. Cannot update completed tasks.
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project = await session.get(Project, task.project_id)
    if project.assigned_solver_id != solver.id:
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    if task.status == TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update a completed task")

    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if deadline is not None:
        task.deadline = deadline

    task.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(task)
    return task
