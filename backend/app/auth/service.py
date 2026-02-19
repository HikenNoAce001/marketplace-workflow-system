# Auth service — refresh token management.

from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.auth.utils import (
    create_refresh_token,
    get_refresh_token_expiry,
    hash_token,
)


async def create_and_store_refresh_token(session: AsyncSession, user_id: UUID) -> str:
    # Generate refresh token, store hash in DB, return raw for cookie.
    raw_token = create_refresh_token()
    db_token = RefreshToken(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        expires_at=get_refresh_token_expiry(),
    )
    session.add(db_token)
    await session.commit()
    return raw_token


async def validate_refresh_token(session: AsyncSession, raw_token: str) -> User | None:
    # Hash the raw token, look up in DB, return user if valid and not expired.
    token_hash = hash_token(raw_token)
    stmt = select(RefreshToken).where(
        RefreshToken.token_hash == token_hash,
        RefreshToken.expires_at > datetime.now(timezone.utc),
    )
    result = await session.exec(stmt)
    db_token = result.first()

    if not db_token:
        return None

    user = await session.get(User, db_token.user_id)
    return user


async def revoke_refresh_token(session: AsyncSession, raw_token: str) -> None:
    # Delete a refresh token from DB so it can never be reused.
    token_hash = hash_token(raw_token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await session.exec(stmt)
    db_token = result.first()
    if db_token:
        await session.delete(db_token)
        await session.commit()
