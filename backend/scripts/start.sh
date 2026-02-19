#!/bin/sh

echo "Running database migrations..."
alembic upgrade head

echo "Seeding test users..."
python -m scripts.seed

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
