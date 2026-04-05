.PHONY: up down logs db migrate seed seed-reset shell reset lint test \
        prod-up prod-down prod-build prod-logs prod-migrate prod-deploy

# ── Development ───────────────────────────────────────────────────────────────
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

# ── Production ────────────────────────────────────────────────────────────────
prod-up:
	docker compose -f docker-compose.prod.yml --env-file .env.production up -d

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.production down

prod-build:
	docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache

prod-logs:
	docker compose -f docker-compose.prod.yml logs -f

prod-migrate:
	docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

prod-restart:
	docker compose -f docker-compose.prod.yml --env-file .env.production restart

# Full deploy: rebuild images, restart containers, run migrations
prod-deploy:
	docker compose -f docker-compose.prod.yml --env-file .env.production build --no-cache
	docker compose -f docker-compose.prod.yml --env-file .env.production up -d
	docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
