from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import String
from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    BUYER = "BUYER"
    SOLVER = "SOLVER"


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", "provider", name="uq_user_email_provider"),)

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    email: str = Field(index=True)
    name: str
    avatar_url: str | None = None
    bio: str | None = None
    skills: list[str] = Field(default=[], sa_column=Column(ARRAY(String)))
    provider: str  # "GOOGLE" or "GITHUB"
    provider_id: str
    role: UserRole = Field(default=UserRole.SOLVER)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
