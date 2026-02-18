"""
Auth Service — handles ALL auth business logic.

Responsibilities:
1. Build OAuth authorization URLs (Google, GitHub)
2. Exchange OAuth codes for user profile info
3. Upsert user in DB (create if new, update if exists)
4. Create/validate/revoke refresh tokens

NO HTTP logic here — that lives in router.py.
"""

from datetime import datetime, timezone
from uuid import UUID

import httpx  # Async HTTP client — used to call Google/GitHub APIs
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.auth.utils import (
    create_access_token,
    create_refresh_token,
    get_refresh_token_expiry,
    hash_token,
)


# ---------------------------------------------------------------------------
# OAuth: build authorization URLs
# These return the URL that the frontend redirects the user to.
# The user logs in on Google/GitHub, then gets redirected back with a ?code=
# ---------------------------------------------------------------------------

def get_google_auth_url() -> str:
    """Build Google OAuth consent screen URL.
    - scope=openid email profile → we get email, name, avatar
    - access_type=offline → Google gives us a refresh token (not used, but good practice)
    """
    params = (
        f"client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        f"&response_type=code"
        f"&scope=openid email profile"
        f"&access_type=offline"
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def get_github_auth_url() -> str:
    """Build GitHub OAuth authorization URL.
    - scope=read:user user:email → we get profile + email access
    """
    params = (
        f"client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
        f"&scope=read:user user:email"
    )
    return f"https://github.com/login/oauth/authorize?{params}"


# ---------------------------------------------------------------------------
# OAuth: exchange authorization code for user info
# Flow: code → access_token → user profile data
# This is the "server-side" part of OAuth — frontend never sees these calls.
# ---------------------------------------------------------------------------

async def exchange_google_code(code: str) -> dict:
    """
    1. Send code to Google's token endpoint → get access_token
    2. Use access_token to call Google's userinfo API → get email, name, avatar
    3. Return normalized dict with provider info
    """
    async with httpx.AsyncClient() as client:
        # Step 1: Exchange authorization code for access token
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_res.raise_for_status()  # Raises exception on 4xx/5xx
        access_token = token_res.json()["access_token"]

        # Step 2: Fetch user profile using the access token
        user_res = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_res.raise_for_status()
        data = user_res.json()

    # Step 3: Normalize into a common format (same shape as GitHub)
    return {
        "email": data["email"],
        "name": data.get("name", data["email"]),
        "avatar_url": data.get("picture"),
        "provider": "GOOGLE",
        "provider_id": data["id"],
    }


async def exchange_github_code(code: str) -> dict:
    """
    1. Send code to GitHub's token endpoint → get access_token
    2. Use access_token to call GitHub's user API → get profile
    3. If email is private, fetch from /user/emails endpoint
    4. Return normalized dict with provider info
    """
    async with httpx.AsyncClient() as client:
        # Step 1: Exchange code for access token
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},  # GitHub defaults to URL-encoded, we want JSON
        )
        token_res.raise_for_status()
        access_token = token_res.json()["access_token"]

        # Step 2: Fetch user profile
        user_res = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_res.raise_for_status()
        data = user_res.json()

        # Step 3: GitHub allows private emails — if email is null, fetch it separately
        email = data.get("email")
        if not email:
            email_res = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            email_res.raise_for_status()
            # Find the primary verified email from the list
            for e in email_res.json():
                if e.get("primary") and e.get("verified"):
                    email = e["email"]
                    break

    # Step 4: Normalize into common format
    return {
        "email": email,
        "name": data.get("name") or data.get("login", ""),  # Some users have no "name", fallback to username
        "avatar_url": data.get("avatar_url"),
        "provider": "GITHUB",
        "provider_id": str(data["id"]),  # GitHub IDs are integers, we store as string
    }


# ---------------------------------------------------------------------------
# User upsert: find existing user or create new one
# "Upsert" = UPDATE if exists, INSERT if not.
# Called after every successful OAuth login.
# ---------------------------------------------------------------------------

async def upsert_user(session: AsyncSession, user_data: dict) -> User:
    """
    Look up user by (email + provider) composite unique key.
    - If found: update name/avatar (may have changed on Google/GitHub)
    - If not found: create new user with SOLVER role (default per requirements)
    - Special case: if email matches ADMIN_EMAIL from config, assign ADMIN role
    """
    # Query by the unique constraint: same email + same provider = same user
    stmt = select(User).where(
        User.email == user_data["email"],
        User.provider == user_data["provider"],
    )
    result = await session.exec(stmt)
    user = result.first()

    if user:
        # Existing user — update fields that may change on the OAuth provider
        user.name = user_data["name"]
        user.avatar_url = user_data.get("avatar_url")
        user.updated_at = datetime.now(timezone.utc)
    else:
        # New user — check if they should be auto-promoted to ADMIN
        # This is how the first admin gets created (from ADMIN_EMAIL env var)
        role = UserRole.ADMIN if user_data["email"] == settings.ADMIN_EMAIL else UserRole.SOLVER
        user = User(
            email=user_data["email"],
            name=user_data["name"],
            avatar_url=user_data.get("avatar_url"),
            provider=user_data["provider"],
            provider_id=user_data["provider_id"],
            role=role,
        )
        session.add(user)

    await session.commit()
    await session.refresh(user)  # Refresh to get DB-generated values (like id if needed)
    return user


# ---------------------------------------------------------------------------
# Refresh token management
# Why hash? If the DB is leaked, raw tokens would let attackers impersonate users.
# By storing hashes, leaked data is useless — you can't reverse a SHA-256 hash.
# ---------------------------------------------------------------------------

async def create_and_store_refresh_token(session: AsyncSession, user_id: UUID) -> str:
    """
    1. Generate a random 64-byte URL-safe token (cryptographically secure)
    2. Store SHA-256 hash in DB (never store raw token)
    3. Return raw token — this goes into the httpOnly cookie
    """
    raw_token = create_refresh_token()  # secrets.token_urlsafe(64)
    db_token = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),  # SHA-256 hash stored in DB
        expires_at=get_refresh_token_expiry(),  # now + 7 days
    )
    session.add(db_token)
    await session.commit()
    return raw_token  # Raw token goes to cookie, hash stays in DB


async def validate_refresh_token(session: AsyncSession, raw_token: str) -> User | None:
    """
    1. Hash the raw token from the cookie
    2. Look up matching hash in DB that hasn't expired
    3. If found, return the associated user
    4. If not found or expired, return None → triggers re-login
    """
    token_hash = hash_token(raw_token)
    stmt = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash,
        RefreshToken.expires_at > datetime.now(timezone.utc),  # Not expired
    )
    result = await session.exec(stmt)
    db_token = result.first()

    if not db_token:
        return None  # Token invalid or expired

    # Token is valid — fetch the user it belongs to
    user = await session.get(User, db_token.user_id)
    return user


async def revoke_refresh_token(session: AsyncSession, raw_token: str) -> None:
    """
    Delete the refresh token from DB.
    Called on logout — ensures the token can never be used again.
    """
    token_hash = hash_token(raw_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await session.exec(stmt)
    db_token = result.first()
    if db_token:
        await session.delete(db_token)
        await session.commit()
