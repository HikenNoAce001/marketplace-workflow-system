"""
Dependencies — reusable FastAPI dependency functions.

These are injected into route handlers via Depends().
Every protected endpoint uses get_current_user.
Role-restricted endpoints use require_role.

Example usage in a router:
    @router.post("/projects")
    async def create_project(
        current_user: User = Depends(require_role(UserRole.BUYER)),
        session: AsyncSession = Depends(get_session),
    ):
"""

from fastapi import Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.utils import decode_access_token
from app.database import get_session
from app.models.user import User, UserRole


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    """
    Extract and validate the access token from the Authorization header.

    Flow:
    1. Read "Authorization: Bearer <token>" header
    2. Decode JWT → get user_id and role from payload
    3. Look up user in DB to ensure they still exist
    4. Return the User object

    Raises 401 if:
    - No Authorization header
    - Token is malformed or expired (PyJWT raises exceptions)
    - User no longer exists in DB
    """
    # Step 1: Extract token from "Bearer xxx" header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]  # "Bearer abc123" → "abc123"

    # Step 2: Decode JWT — PyJWT validates signature + expiry automatically
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Step 3: Look up user in DB — token might be valid but user might be deleted
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def require_role(*roles: UserRole):
    """
    Factory function that creates a dependency requiring specific role(s).

    Usage:
        # Single role
        current_user: User = Depends(require_role(UserRole.BUYER))

        # Multiple roles
        current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.BUYER))

    How it works:
    1. This function returns ANOTHER function (a closure)
    2. The inner function calls get_current_user first
    3. Then checks if the user's role is in the allowed list
    4. Returns the user if allowed, raises 403 if not
    """
    async def role_checker(
        request: Request,
        session: AsyncSession = Depends(get_session),
    ) -> User:
        # First, authenticate (get user from token)
        user = await get_current_user(request, session)

        # Then, authorize (check role)
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role {user.role.value} is not allowed. Required: {[r.value for r in roles]}",
            )
        return user

    return role_checker
