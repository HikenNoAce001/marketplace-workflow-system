"""
Request Schemas — API shapes for the bidding/request system.

A "request" here = a solver asking to work on a project (a bid).
Not to be confused with HTTP requests.
"""

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class RequestCreate(SQLModel):
    """Solver submits a cover letter to request working on a project."""
    cover_letter: str


class RequestRead(SQLModel):
    """What the API returns for a single request."""
    id: UUID
    project_id: UUID
    solver_id: UUID
    cover_letter: str
    status: str
    created_at: datetime
    updated_at: datetime


class RequestListResponse(SQLModel):
    """Paginated list of requests."""
    data: list[RequestRead]
    meta: dict
