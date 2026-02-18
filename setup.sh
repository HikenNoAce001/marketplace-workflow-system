#!/usr/bin/env bash
set -euo pipefail

echo "=== Marketplace Project Workflow System — Setup ==="

# Copy .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
else
    echo ".env already exists, skipping"
fi

# Build and start all services
echo "Starting Docker services..."
docker compose up --build -d

# Wait for backend to be healthy
echo "Waiting for backend..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "Backend is up!"
        break
    fi
    sleep 2
done

echo ""
echo "=== Services ==="
echo "Backend:       http://localhost:8000"
echo "API Health:    http://localhost:8000/api/health"
echo "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
echo ""
echo "Done! Run 'docker compose logs -f backend' to watch logs."
