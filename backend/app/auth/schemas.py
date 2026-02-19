from uuid import UUID

from sqlmodel import SQLModel


class TokenResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"


class UserRead(SQLModel):
    id: UUID
    email: str
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    skills: list[str] = []
    role: str
