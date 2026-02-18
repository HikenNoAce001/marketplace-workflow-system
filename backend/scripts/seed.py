"""
Seed Script — populates the database with test users for development.

Creates 3 users (one per role):
  1. Admin  — admin@test.com
  2. Buyer  — buyer@test.com
  3. Solver — solver@test.com

All users use provider="DEV" (not a real OAuth provider).
This is for development/testing only.

Usage:
  docker compose exec backend python -m scripts.seed
  OR
  make seed
"""

import asyncio

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import async_session_factory
from app.models.user import User, UserRole


# Test users to create
SEED_USERS = [
    {
        "email": "admin@test.com",
        "name": "Test Admin",
        "provider": "DEV",
        "provider_id": "dev-admin-001",
        "role": UserRole.ADMIN,
    },
    {
        "email": "buyer@test.com",
        "name": "Test Buyer",
        "provider": "DEV",
        "provider_id": "dev-buyer-001",
        "role": UserRole.BUYER,
    },
    {
        "email": "solver@test.com",
        "name": "Test Solver",
        "provider": "DEV",
        "provider_id": "dev-solver-001",
        "role": UserRole.SOLVER,
        "bio": "Full-stack developer with 5 years experience",
        "skills": ["Python", "React", "PostgreSQL", "Docker"],
    },
]


async def seed():
    async with async_session_factory() as session:
        for user_data in SEED_USERS:
            # Check if user already exists (idempotent — safe to run multiple times)
            stmt = select(User).where(
                User.email == user_data["email"],
                User.provider == user_data["provider"],
            )
            result = await session.exec(stmt)
            existing = result.first()

            if existing:
                print(f"  SKIP  {user_data['role'].value:6s}  {user_data['email']} (already exists)")
                continue

            user = User(**user_data)
            session.add(user)
            print(f"  CREATE {user_data['role'].value:6s}  {user_data['email']}")

        await session.commit()

    print("\nDone! Use POST /api/auth/dev-login to get a token for any seeded user.")


if __name__ == "__main__":
    print("Seeding database...\n")
    asyncio.run(seed())
