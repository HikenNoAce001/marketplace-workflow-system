.PHONY: up down build logs restart db-shell migrate seed reset test-flow front front-build front-lint

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose up --build -d

logs:
	docker compose logs -f backend

restart:
	docker compose restart backend

db-shell:
	docker compose exec postgres psql -U marketplace -d marketplace

migrate:
	docker compose exec backend alembic upgrade head

migrate-new:
	docker compose exec backend alembic revision --autogenerate -m "$(msg)"

seed:
	docker compose exec backend python -m scripts.seed

reset:
	docker compose exec backend python -m scripts.reset_db

health:
	curl -s http://localhost:8000/api/health | python3 -m json.tool

test-flow:
	docker compose exec backend python -m scripts.test_workflow

front:
	cd frontend && npm run dev

front-build:
	cd frontend && npm run build

front-lint:
	cd frontend && npm run lint
