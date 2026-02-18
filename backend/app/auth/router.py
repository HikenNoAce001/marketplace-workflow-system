"""
Auth Router — HTTP layer for authentication.

Endpoints:
  GET  /api/auth/google           → Returns Google OAuth URL
  GET  /api/auth/github           → Returns GitHub OAuth URL
  GET  /api/auth/callback/google  → Handles Google redirect with ?code=
  GET  /api/auth/callback/github  → Handles GitHub redirect with ?code=
  GET  /api/auth/me               → Returns current user from access token
  POST /api/auth/refresh          → Exchanges refresh cookie for new access token
  POST /api/auth/logout           → Revokes refresh token + clears cookie

Router is THIN — all business logic lives in service.py.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.database import get_session
from app.auth import service
from app.auth.schemas import AuthURLResponse, TokenResponse, UserRead
from app.auth.utils import create_access_token
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_refresh_cookie(response: Response, raw_token: str) -> None:
    """
    Set the refresh token as an httpOnly cookie with environment-aware settings.

    Development (localhost HTTP):
      secure=False, samesite=lax — standard same-origin setup

    Production (Railway HTTPS, cross-origin subdomains):
      secure=True  — required because Railway serves HTTPS
      samesite=none — required because frontend (frontend-xxx.railway.app) and
                      backend (backend-yyy.railway.app) are different origins.
                      Without SameSite=None, the browser refuses to send the
                      cookie on cross-origin fetch() calls.

    We do NOT set the `domain` field. When omitted, the cookie is scoped to
    the exact host that set it (backend-yyy.railway.app). Setting it to
    ".railway.app" would leak cookies to ALL Railway services — a security hole.
    """
    response.set_cookie(
        key="refresh_token",
        value=raw_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=7 * 24 * 60 * 60,  # 7 days in seconds
        path="/",
    )


# ---------------------------------------------------------------------------
# Step 1: Frontend calls these to get the OAuth URL, then redirects user there
# ---------------------------------------------------------------------------

@router.get("/google", response_model=AuthURLResponse)
async def google_auth_url():
    """Return Google OAuth consent screen URL."""
    return AuthURLResponse(url=service.get_google_auth_url())


@router.get("/github", response_model=AuthURLResponse)
async def github_auth_url():
    """Return GitHub OAuth authorization URL."""
    return AuthURLResponse(url=service.get_github_auth_url())


# ---------------------------------------------------------------------------
# Step 2: OAuth provider redirects back here with ?code=
# We exchange the code, upsert the user, create tokens, set cookie.
# ---------------------------------------------------------------------------

@router.get("/callback/google", response_model=TokenResponse)
async def google_callback(
    code: str,  # The authorization code from Google's redirect
    response: Response,  # Needed to set the httpOnly cookie
    session: AsyncSession = Depends(get_session),
):
    """
    1. Exchange Google code → user info (email, name, avatar)
    2. Upsert user in DB (create if new, update if existing)
    3. Create refresh token → store hash in DB, raw in httpOnly cookie
    4. Create access token → return in response body (frontend stores in Zustand memory)
    """
    try:
        user_data = await service.exchange_google_code(code)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to authenticate with Google")

    # Upsert: creates new SOLVER user or updates existing user
    user = await service.upsert_user(session, user_data)

    # Create refresh token: raw goes to cookie, hash goes to DB
    raw_refresh = await service.create_and_store_refresh_token(session, user.id)

    # Set httpOnly cookie — browser sends this automatically on every request
    _set_refresh_cookie(response, raw_refresh)

    # Access token returned in body — frontend stores in Zustand (JS memory only)
    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token)


@router.get("/callback/github", response_model=TokenResponse)
async def github_callback(
    code: str,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Same flow as Google callback — exchange code, upsert user, create tokens."""
    try:
        user_data = await service.exchange_github_code(code)
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to authenticate with GitHub")

    user = await service.upsert_user(session, user_data)
    raw_refresh = await service.create_and_store_refresh_token(session, user.id)

    _set_refresh_cookie(response, raw_refresh)

    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Step 3: Frontend calls /me on app load to get current user identity
# Uses the access token from Authorization header (via get_current_user dependency)
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserRead)
async def get_me(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """
    Decode access token from Authorization header → return user data.
    This is called on every page load to hydrate the frontend's user state.
    Import here to avoid circular imports (dependencies imports auth.utils).
    """
    from app.dependencies import get_current_user
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


# ---------------------------------------------------------------------------
# Step 4: When access token expires (401), frontend calls this.
# The refresh cookie is sent automatically by the browser.
# ---------------------------------------------------------------------------

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,  # Need request to read the cookie
    response: Response,  # Need response to set new cookie
    session: AsyncSession = Depends(get_session),
):
    """
    1. Read refresh_token from httpOnly cookie (browser sends automatically)
    2. Validate: hash it → look up in DB → check not expired
    3. If valid: revoke old token, create new one (token rotation for security)
    4. Return new access_token in body
    If invalid: return 401 → frontend redirects to login
    """
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(status_code=401, detail="No refresh token")

    # Validate: hash the cookie value → look up in DB
    user = await service.validate_refresh_token(session, raw_token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    # Token rotation: revoke old token, create new one
    # This means each refresh token can only be used ONCE
    # If an attacker steals a used token, it's already revoked
    await service.revoke_refresh_token(session, raw_token)
    new_raw_refresh = await service.create_and_store_refresh_token(session, user.id)

    # Set new refresh cookie
    _set_refresh_cookie(response, new_raw_refresh)

    # Return new access token
    access_token = create_access_token(user.id, user.role.value)
    return TokenResponse(access_token=access_token)


# ---------------------------------------------------------------------------
# Step 5: Logout — revoke refresh token + clear cookie
# ---------------------------------------------------------------------------

@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """
    1. Read refresh cookie
    2. Delete the token from DB (can never be used again)
    3. Clear the cookie from browser
    Frontend also clears Zustand (access token from memory).
    """
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        await service.revoke_refresh_token(session, raw_token)

    # Delete cookie from browser by setting max_age=0
    response.delete_cookie(key="refresh_token", path="/")


# ---------------------------------------------------------------------------
# DEV / DEMO: Login by email (bypasses OAuth for testing)
# Controlled by ENABLE_DEV_LOGIN setting — toggle without a code change.
# ---------------------------------------------------------------------------

if settings.ENABLE_DEV_LOGIN:
    class DevLoginRequest(SQLModel):
        email: str

    @router.post("/dev-login", response_model=TokenResponse)
    async def dev_login(
        body: DevLoginRequest,
        response: Response,
        session: AsyncSession = Depends(get_session),
    ):
        """
        DEV / DEMO — Get a JWT for any user by email. No OAuth required.
        Controlled by ENABLE_DEV_LOGIN env var (default True).
        """
        stmt = select(User).where(User.email == body.email)
        result = await session.exec(stmt)
        user = result.first()

        if not user:
            raise HTTPException(status_code=404, detail=f"No user with email {body.email}")

        # Create refresh token (same as real login)
        raw_refresh = await service.create_and_store_refresh_token(session, user.id)
        _set_refresh_cookie(response, raw_refresh)

        # Return access token
        access_token = create_access_token(user.id, user.role.value)
        return TokenResponse(access_token=access_token)
