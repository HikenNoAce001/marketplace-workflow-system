from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlmodel import SQLModel


class ProjectCreate(SQLModel):
    title: str
    description: str
    budget: Decimal | None = None
    deadline: datetime | None = None


class ProjectUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    budget: Decimal | None = None
    deadline: datetime | None = None


class ProjectRead(SQLModel):
    id: UUID
    title: str
    description: str
    budget: Decimal | None = None
    deadline: datetime | None = None
    status: str
    buyer_id: UUID
    assigned_solver_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    buyer_name: str = ""
    assigned_solver_name: str | None = None


class ProjectListResponse(SQLModel):
    data: list[ProjectRead]
    meta: dict
