.PHONY: up down logs db migrate seed seed-reset shell reset lint test

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

db:
	docker compose exec postgres psql -U vaidya -d vaidya

migrate:
	docker compose exec backend alembic upgrade head

seed:
	backend/.venv/bin/python scripts/seed.py

seed-reset:
	backend/.venv/bin/python scripts/seed.py --reset

shell:
	docker compose exec backend bash

reset:
	docker compose down -v && docker compose up --build

# Dev helpers
ps:
	docker compose ps

build:
	docker compose build

restart:
	docker compose restart

backend-logs:
	docker compose logs -f backend

frontend-logs:
	docker compose logs -f frontend
