"""
Task Schemas — API shapes for task management.

Tasks are sub-modules of a project. Only the assigned solver can create them.
Tasks start as IN_PROGRESS (no TODO state per PDF spec).
"""

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class TaskCreate(SQLModel):
    """Solver creates a task with title, description, optional deadline."""
    title: str
    description: str
    deadline: datetime | None = None


class TaskUpdate(SQLModel):
    """Solver can update title, description, deadline on non-COMPLETED tasks."""
    title: str | None = None
    description: str | None = None
    deadline: datetime | None = None


class TaskRead(SQLModel):
    """What the API returns for a single task."""
    id: UUID
    project_id: UUID
    created_by: UUID
    title: str
    description: str
    deadline: datetime | None = None
    status: str
    created_at: datetime
    updated_at: datetime


class TaskListResponse(SQLModel):
    """Paginated list of tasks for a project."""
    data: list[TaskRead]
    meta: dict
