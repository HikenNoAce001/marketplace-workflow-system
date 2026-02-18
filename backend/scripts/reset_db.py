"""
Reset Script — wipes ALL data from the database and re-seeds test users.

This uses TRUNCATE ... CASCADE to clear all tables in one shot,
then runs the seed to recreate the 3 test users.

Usage:
  docker compose exec backend python -m scripts.reset_db
  OR
  make reset
"""

import asyncio

from sqlalchemy import text

from app.database import async_session_factory
from scripts.seed import seed


async def reset():
    async with async_session_factory() as session:
        # TRUNCATE CASCADE wipes all rows and follows foreign key chains.
        # We list the "root" tables — CASCADE handles the rest.
        await session.exec(
            text(
                "TRUNCATE TABLE submissions, tasks, project_requests, projects, refresh_tokens, users CASCADE"
            )
        )
        await session.commit()
        print("All tables truncated.\n")

    # Re-create the 3 test users
    await seed()


if __name__ == "__main__":
    print("Resetting database...\n")
    asyncio.run(reset())
