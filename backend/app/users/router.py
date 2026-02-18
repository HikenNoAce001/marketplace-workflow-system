"""
User Router — HTTP endpoints for user management.

Endpoints:
  GET   /api/users              → List all users (ADMIN only)
  GET   /api/users/{id}         → Get single user (ADMIN only)
  PATCH /api/users/{id}/role    → Change user role (ADMIN only)
  PATCH /api/users/me/profile   → Update own profile (any authenticated user)
"""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.dependencies import get_current_user, require_role
from app.models.user import User, UserRole
from app.users import service
from app.users.schemas import UserListResponse, UserRead, UserUpdateProfile, UserUpdateRole

router = APIRouter(prefix="/api/users", tags=["users"])


# ---------------------------------------------------------------------------
# ADMIN endpoints — require ADMIN role
# ---------------------------------------------------------------------------

@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_role(UserRole.ADMIN)),  # Only admins can list all users
    session: AsyncSession = Depends(get_session),
):
    """List all users with pagination. ADMIN only."""
    result = await service.list_users(session, page, limit)
    return UserListResponse(
        data=[
            UserRead(
                id=u.id, email=u.email, name=u.name,
                avatar_url=u.avatar_url, bio=u.bio,
                skills=u.skills, role=u.role.value, created_at=u.created_at,
            )
            for u in result["data"]
        ],
        meta=result["meta"],
    )


@router.get("/me/profile", response_model=UserRead)
async def get_my_profile(
    current_user: User = Depends(get_current_user),  # Any authenticated user
    session: AsyncSession = Depends(get_session),
):
    """Get own profile. Must be defined BEFORE /{user_id} to avoid route conflict."""
    return UserRead(
        id=current_user.id, email=current_user.email, name=current_user.name,
        avatar_url=current_user.avatar_url, bio=current_user.bio,
        skills=current_user.skills, role=current_user.role.value,
        created_at=current_user.created_at,
    )


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(require_role(UserRole.ADMIN)),  # Only admins can view any user
    session: AsyncSession = Depends(get_session),
):
    """Get a single user by ID. ADMIN only."""
    user = await service.get_user_by_id(session, user_id)
    return UserRead(
        id=user.id, email=user.email, name=user.name,
        avatar_url=user.avatar_url, bio=user.bio,
        skills=user.skills, role=user.role.value, created_at=user.created_at,
    )


@router.patch("/{user_id}/role", response_model=UserRead)
async def update_role(
    user_id: UUID,
    body: UserUpdateRole,
    current_user: User = Depends(require_role(UserRole.ADMIN)),  # Only admins can change roles
    session: AsyncSession = Depends(get_session),
):
    """Change a user's role. ADMIN only. Can only set BUYER or SOLVER."""
    user = await service.update_user_role(session, user_id, body.role, current_user)
    return UserRead(
        id=user.id, email=user.email, name=user.name,
        avatar_url=user.avatar_url, bio=user.bio,
        skills=user.skills, role=user.role.value, created_at=user.created_at,
    )


# ---------------------------------------------------------------------------
# Self-service endpoint — any authenticated user
# ---------------------------------------------------------------------------

@router.patch("/me/profile", response_model=UserRead)
async def update_my_profile(
    body: UserUpdateProfile,
    current_user: User = Depends(get_current_user),  # Any authenticated user
    session: AsyncSession = Depends(get_session),
):
    """Update own bio and skills."""
    user = await service.update_profile(session, current_user, body.bio, body.skills)
    return UserRead(
        id=user.id, email=user.email, name=user.name,
        avatar_url=user.avatar_url, bio=user.bio,
        skills=user.skills, role=user.role.value, created_at=user.created_at,
    )
