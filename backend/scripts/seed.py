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


# Test users to create — enough variety for the recruiter to test all workflows
SEED_USERS = [
    # --- ADMINS (2) ---
    {
        "email": "admin@test.com",
        "name": "Sarah Chen",
        "provider": "DEV",
        "provider_id": "dev-admin-001",
        "role": UserRole.ADMIN,
    },
    {
        "email": "admin2@test.com",
        "name": "Marcus Johnson",
        "provider": "DEV",
        "provider_id": "dev-admin-002",
        "role": UserRole.ADMIN,
    },
    # --- BUYERS (3) ---
    {
        "email": "buyer@test.com",
        "name": "Emily Rodriguez",
        "provider": "DEV",
        "provider_id": "dev-buyer-001",
        "role": UserRole.BUYER,
    },
    {
        "email": "buyer2@test.com",
        "name": "James Park",
        "provider": "DEV",
        "provider_id": "dev-buyer-002",
        "role": UserRole.BUYER,
    },
    {
        "email": "buyer3@test.com",
        "name": "Aisha Patel",
        "provider": "DEV",
        "provider_id": "dev-buyer-003",
        "role": UserRole.BUYER,
    },
    # --- SOLVERS (4) ---
    {
        "email": "solver@test.com",
        "name": "Alex Thompson",
        "provider": "DEV",
        "provider_id": "dev-solver-001",
        "role": UserRole.SOLVER,
        "bio": "Full-stack developer with 5 years experience in Python and React",
        "skills": ["Python", "React", "PostgreSQL", "Docker"],
    },
    {
        "email": "solver2@test.com",
        "name": "Priya Sharma",
        "provider": "DEV",
        "provider_id": "dev-solver-002",
        "role": UserRole.SOLVER,
        "bio": "Backend specialist focused on distributed systems and APIs",
        "skills": ["Go", "Kubernetes", "gRPC", "Redis"],
    },
    {
        "email": "solver3@test.com",
        "name": "David Kim",
        "provider": "DEV",
        "provider_id": "dev-solver-003",
        "role": UserRole.SOLVER,
        "bio": "Frontend engineer passionate about UI/UX and accessibility",
        "skills": ["TypeScript", "Next.js", "Tailwind", "Figma"],
    },
    {
        "email": "solver4@test.com",
        "name": "Lisa Wang",
        "provider": "DEV",
        "provider_id": "dev-solver-004",
        "role": UserRole.SOLVER,
        "bio": "DevOps engineer specializing in CI/CD and cloud infrastructure",
        "skills": ["AWS", "Terraform", "Python", "GitHub Actions"],
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
