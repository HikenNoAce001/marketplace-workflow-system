"""
User Service — business logic for user management.

Who can do what:
  - ADMIN: list all users, view any user, change roles (SOLVER ↔ BUYER)
  - SOLVER: update own profile (bio, skills)
  - All authenticated: view own profile (handled by /auth/me)
"""

import math
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User, UserRole


async def list_users(session: AsyncSession, page: int = 1, limit: int = 20) -> dict:
    """
    List all users with pagination. ADMIN only.

    Returns { data: [...], meta: { page, limit, total, total_pages } }
    This matches our standard paginated response format.
    """
    # Count total users — needed for total_pages calculation
    count_stmt = select(func.count()).select_from(User)
    total = (await session.exec(count_stmt)).one()

    # Fetch the page of users — offset = how many to skip, limit = how many to take
    offset = (page - 1) * limit
    stmt = select(User).offset(offset).limit(limit).order_by(User.created_at.desc())
    result = await session.exec(stmt)
    users = result.all()

    return {
        "data": users,
        "meta": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": math.ceil(total / limit) if limit > 0 else 0,
        },
    }


async def get_user_by_id(session: AsyncSession, user_id: UUID) -> User:
    """Fetch a single user by ID. Raises 404 if not found."""
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def update_user_role(
    session: AsyncSession, user_id: UUID, new_role: str, admin: User
) -> User:
    """
    Admin changes a user's role. Rules:
    1. Can only set BUYER or SOLVER (never ADMIN — admins are seeded only)
    2. Cannot change own role (admin can't demote themselves)
    3. Cannot change another admin's role
    """
    # Validate the role string is a valid UserRole
    if new_role not in (UserRole.BUYER.value, UserRole.SOLVER.value):
        raise HTTPException(status_code=400, detail="Role must be BUYER or SOLVER")

    # Cannot change own role
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Cannot change another admin's role
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="Cannot change an admin's role")

    # Apply the role change
    user.role = UserRole(new_role)
    user.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    return user


async def update_profile(
    session: AsyncSession, user: User, bio: str | None, skills: list[str] | None
) -> User:
    """
    User updates their own profile (bio and/or skills).
    Only updates fields that are provided (not None).
    """
    if bio is not None:
        user.bio = bio
    if skills is not None:
        user.skills = skills
    user.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    return user
