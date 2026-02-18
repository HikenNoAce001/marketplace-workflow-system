"""
User Schemas — request/response shapes for user endpoints.

Separate from the User table model.
Table model = database structure.
Schemas = what the API accepts and returns.
"""

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class UserRead(SQLModel):
    """What the API returns when you fetch a user."""
    id: UUID
    email: str
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    skills: list[str] = []
    role: str
    created_at: datetime


class UserUpdateRole(SQLModel):
    """Admin uses this to change a user's role (SOLVER → BUYER)."""
    role: str  # Must be "BUYER" or "SOLVER" — validated in service layer


class UserUpdateProfile(SQLModel):
    """Solver uses this to update their own profile (bio + skills)."""
    bio: str | None = None
    skills: list[str] | None = None


class UserListResponse(SQLModel):
    """Paginated list response — matches our API convention."""
    data: list[UserRead]
    meta: dict  # { page, limit, total, total_pages }
