from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class RequestCreate(SQLModel):
    cover_letter: str


class RequestRead(SQLModel):
    id: UUID
    project_id: UUID
    solver_id: UUID
    cover_letter: str
    status: str
    created_at: datetime
    updated_at: datetime
    solver_name: str = ""
    project_title: str = ""


class RequestListResponse(SQLModel):
    data: list[RequestRead]
    meta: dict
