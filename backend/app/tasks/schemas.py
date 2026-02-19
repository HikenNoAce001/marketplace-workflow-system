from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class TaskCreate(SQLModel):
    title: str
    description: str
    deadline: datetime | None = None


class TaskUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    deadline: datetime | None = None


class TaskRead(SQLModel):
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
    data: list[TaskRead]
    meta: dict
