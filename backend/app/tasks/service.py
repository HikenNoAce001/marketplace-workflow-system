"""
Task Service — business logic for task management.

Who can do what:
  - SOLVER (assigned only): create tasks, update own tasks
  - BUYER (project owner): view tasks on their project
  - ADMIN: view any tasks

Key rules:
  - Tasks can only be created on ASSIGNED projects
  - Only the assigned solver can create/update tasks
  - Tasks start as IN_PROGRESS (no TODO state)
  - Task status is managed by submissions (not directly editable):
      IN_PROGRESS → SUBMITTED (on ZIP upload)
      SUBMITTED → COMPLETED (buyer accepts)
      SUBMITTED → REVISION_REQUESTED (buyer rejects)
      REVISION_REQUESTED → IN_PROGRESS (solver reworks)
"""

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
    """
    Solver creates a task on their assigned project. Rules:
    1. Project must exist and be ASSIGNED (not OPEN, not COMPLETED)
    2. The solver must be the one assigned to this project
    3. Task starts as IN_PROGRESS immediately
    """
    # Load project
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Project must be ASSIGNED — can't create tasks on OPEN (no solver yet) or COMPLETED
    if project.status != ProjectStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Project must be in ASSIGNED status")

    # Must be the assigned solver — not just any solver
    if project.assigned_solver_id != solver.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this project")

    # Create task — starts as IN_PROGRESS (no TODO state per PDF)
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
    """
    List tasks for a project. Access rules:
      - ADMIN: can view tasks on any project
      - BUYER: can view tasks on own projects
      - SOLVER: can view tasks on projects they're assigned to
    """
    # Load project to check access
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Access control
    if user.role == UserRole.ADMIN:
        pass  # Admin sees all
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:  # SOLVER
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    # Count + fetch
    count_stmt = select(func.count()).select_from(Task).where(Task.project_id == project_id)
    total = (await session.exec(count_stmt)).one()

    offset = (page - 1) * limit
    stmt = (
        select(Task)
        .where(Task.project_id == project_id)
        .offset(offset)
        .limit(limit)
        .order_by(Task.created_at.asc())  # Oldest first (creation order)
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
    """Get a single task. Access rules same as list_tasks_for_project."""
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check access via the parent project
    project = await session.get(Project, task.project_id)
    if user.role == UserRole.ADMIN:
        pass
    elif user.role == UserRole.BUYER:
        if project.buyer_id != user.id:
            raise HTTPException(status_code=403, detail="Not your project")
    else:  # SOLVER
        if project.assigned_solver_id != user.id:
            raise HTTPException(status_code=403, detail="Not assigned to this project")

    return task


async def update_task(
    session: AsyncSession, task_id: UUID, solver: User,
    title: str | None = None, description: str | None = None, deadline=None,
) -> Task:
    """
    Solver updates task metadata (title, description, deadline).
    Rules:
    1. Must be the assigned solver
    2. Cannot update COMPLETED tasks (they're done)
    3. Only updates fields that are provided
    Note: status is NOT editable here — it's managed by submissions
    """
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Verify solver is assigned to the parent project
    project = await session.get(Project, task.project_id)
    if project.assigned_solver_id != solver.id:
        raise HTTPException(status_code=403, detail="Not assigned to this project")

    # Can't update completed tasks
    if task.status == TaskStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot update a completed task")

    # Apply partial updates
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
