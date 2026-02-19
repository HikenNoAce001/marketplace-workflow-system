#!/usr/bin/env bash
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

step() { echo -e "\n${GREEN}▸ $1${NC}"; }
warn() { echo -e "${YELLOW}  $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║   Marketplace Workflow System — Full Setup   ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# --- Prerequisites ---
step "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || fail "Docker not found. Install from https://docker.com"
docker info >/dev/null 2>&1 || fail "Docker daemon not running. Start Docker Desktop first."
command -v node >/dev/null 2>&1 || fail "Node.js not found. Install v20.9+ from https://nodejs.org"

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js v20.9+ required (found $(node -v))"
fi

echo "  Docker ✓  Node $(node -v) ✓"

# --- Environment ---
step "Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env from .env.example"
else
  echo "  .env already exists, skipping"
fi

# --- Docker services ---
step "Building and starting Docker services (PostgreSQL, MinIO, Backend)..."
docker compose up --build -d

# Backend container runs migrations + seeds automatically via start.sh
step "Waiting for backend to be ready (migrations + seed run automatically)..."
MAX_WAIT=120
WAITED=0
until curl -sf http://localhost:8000/api/health >/dev/null 2>&1; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo ""
    warn "Backend didn't respond after ${MAX_WAIT}s."
    warn "Check logs: docker compose logs backend"
    fail "Backend health check timed out"
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  printf "\r  Waiting... (%ds)" "$WAITED"
done
echo -e "\r  Backend ready! (${WAITED}s)              "

# --- Frontend ---
step "Installing frontend dependencies..."
cd frontend
npm install --silent 2>&1 | tail -3
cd ..

step "Starting frontend dev server..."
cd frontend
npm run dev &
FRONT_PID=$!
cd ..

# Give Next.js a moment to compile
sleep 6

# --- Done ---
echo -e "\n${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║              Setup Complete!                 ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
echo "║  Frontend:     http://localhost:3000          ║"
echo "║  Backend API:  http://localhost:8000/api      ║"
echo "║  Swagger UI:   http://localhost:8000/docs     ║"
echo "║  MinIO Console: http://localhost:9001         ║"
echo "║                                              ║"
echo "║  Login with any test user on the login page.  ║"
echo "║  Try Admin, Buyer, and Solver roles to see    ║"
echo "║  the full project workflow in action.         ║"
echo "║                                              ║"
echo "║  Stop: Ctrl+C, then 'docker compose down'    ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Keep alive so Ctrl+C stops the frontend
wait $FRONT_PID
