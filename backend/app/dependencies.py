from fastapi import Depends, HTTPException, Request
from sqlmodel.ext.asyncio.session import AsyncSession

from app.auth.utils import decode_access_token
from app.database import get_session
from app.models.user import User, UserRole


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> User:
    # Extract user from the Authorization: Bearer <token> header.
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]

    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def require_role(*roles: UserRole):
    # Dependency factory that restricts access to specific roles.
    async def role_checker(
        request: Request,
        session: AsyncSession = Depends(get_session),
    ) -> User:
        user = await get_current_user(request, session)
        if user.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role {user.role.value} is not allowed. Required: {[r.value for r in roles]}",
            )
        return user

    return role_checker
