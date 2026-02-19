# Auth router — token refresh, logout, dev login.

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.database import get_session
from app.auth import service
from app.auth.schemas import TokenResponse, UserRead
from app.auth.utils import create_access_token
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    # Set refresh token as httpOnly cookie with env-aware security settings.
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


@router.get("/me", response_model=UserRead)
async def get_me(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    # Return current user from access token. Called on page load to hydrate state.
    from app.dependencies import get_current_user  # avoid circular import
    user = await get_current_user(request=request, session=session)
    return UserRead(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        skills=user.skills,
        role=user.role.value,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    # Rotate refresh token and issue new access token.
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    user = await service.validate_refresh_token(session, raw_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # token rotation — revoke old, issue new
    await service.revoke_refresh_token(session, raw_token)
    new_raw_refresh = await service.create_and_store_refresh_token(session, user.id)
    _set_refresh_cookie(response, new_raw_refresh)

    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Revoke refresh token and clear cookie."""
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        await service.revoke_refresh_token(session, raw_token)

    response.delete_cookie(key="refresh_token", path="/")


# dev/demo login — bypasses OAuth for testing
if settings.ENABLE_DEV_LOGIN:
    class DevLoginRequest(SQLModel):
        email: str

    class DevUserRead(SQLModel):
        email: str
        name: str
        role: str

    @router.get("/dev-users", response_model=list[DevUserRead])
    async def list_dev_users(
        session: AsyncSession = Depends(get_session),
    ):
        """Return all dev-provider users. Public endpoint (dev mode only)."""
        stmt = (
            select(User)
            .where(User.provider == "DEV")
            .order_by(User.email)
        )
        result = await session.exec(stmt)
        users = result.all()
        return [
            DevUserRead(email=u.email, name=u.name, role=u.role.value)
            for u in users
        ]

    @router.post("/dev-login", response_model=TokenResponse)
    async def dev_login(
        body: DevLoginRequest,
        response: Response,
        session: AsyncSession = Depends(get_session),
    ):
        """Login by email without OAuth. Controlled by ENABLE_DEV_LOGIN env var."""
        stmt = select(User).where(User.email == body.email)
        result = await session.exec(stmt)
        user = result.first()

        if not user:
            raise HTTPException(status_code=404, detail=f"No user with email {body.email}")

        raw_refresh = await service.create_and_store_refresh_token(session, user.id)
        _set_refresh_cookie(response, raw_refresh)

        access_token = create_access_token(user.id, user.role.value)
        return TokenResponse(access_token=access_token)
