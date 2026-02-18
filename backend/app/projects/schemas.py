"""
Project Schemas — API shapes for project endpoints.

ProjectCreate: what a BUYER sends to create a project
ProjectUpdate: what a BUYER sends to edit their project
ProjectRead:   what the API returns for a single project
ProjectListResponse: paginated list of projects
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlmodel import SQLModel


class ProjectCreate(SQLModel):
    """Buyer creates a project with these fields."""
    title: str
    description: str
    budget: Decimal | None = None
    deadline: datetime | None = None


class ProjectUpdate(SQLModel):
    """Buyer can update title, description, budget, deadline on OPEN projects only."""
    title: str | None = None
    description: str | None = None
    budget: Decimal | None = None
    deadline: datetime | None = None


class ProjectRead(SQLModel):
    """What the API returns — includes status, buyer_id, solver_id, timestamps."""
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


class ProjectListResponse(SQLModel):
    """Paginated list — matches standard API convention."""
    data: list[ProjectRead]
    meta: dict  # { page, limit, total, total_pages }
