from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class UserRead(SQLModel):
    id: UUID
    email: str
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    skills: list[str] = []
    role: str
    created_at: datetime


class UserUpdateRole(SQLModel):
    role: str


class UserUpdateProfile(SQLModel):
    bio: str | None = None
    skills: list[str] | None = None


class UserListResponse(SQLModel):
    data: list[UserRead]
    meta: dict
