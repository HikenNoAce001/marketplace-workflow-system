#!/bin/sh
# Production startup script — runs on every Railway deploy.
#
# 1. Apply database migrations (idempotent — skips already-applied ones)
# 2. Seed test users (idempotent — skips existing users)
# 3. Start the application server
#
# Using `exec` replaces this shell process with uvicorn,
# so uvicorn becomes PID 1 and receives signals properly (graceful shutdown).

echo "Running database migrations..."
alembic upgrade head

echo "Seeding test users..."
python -m scripts.seed

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
