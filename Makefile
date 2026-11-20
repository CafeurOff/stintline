# StintLine developer entry points. Run `make help` for the list.
SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose -f infra/docker-compose.yml
MANAGE := uv run python apps/api/manage.py

.PHONY: help
help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------- setup
.PHONY: setup
setup: ## Install Python + JS dependencies, browsers and git hooks
	uv sync --all-packages
	pnpm install
	pnpm --filter web exec playwright install chromium
	uv tool install pre-commit || true
	pre-commit install
	@test -f .env || (cp .env.example .env && echo "Created .env from .env.example")

# ---------------------------------------------------------------- run
.PHONY: up down logs
up: ## Build and start the whole stack (http://localhost:5173)
	@test -f .env || cp .env.example .env
	$(COMPOSE) up --build

.PHONY: live
live: ## Follow the live timing feed locally (personal use, home connection only)
	docker compose -f infra/docker-compose.yml --profile live up -d live

.PHONY: live-replay
live-replay: ## Replay a recording as if live: make live-replay FILE=recordings/x.jsonl SPEED=10
	docker compose -f infra/docker-compose.yml --profile live run --rm live \
		python manage.py live --replay /app/$(FILE) --speed $(or $(SPEED),10)

down: ## Stop the stack (keeps the database volume)
	$(COMPOSE) down

logs: ## Follow logs of every service
	$(COMPOSE) logs -f

# ---------------------------------------------------------------- public demo (replay-only)
DEMO := docker compose -f infra/docker-compose.demo.yml --env-file infra/demo.env

.PHONY: demo-up demo-down demo-load
demo-up: ## Build and start the replay-only demo with production images (http://localhost:8080)
	@test -f infra/demo.env || (echo "Copy infra/demo.env.example to infra/demo.env and fill it in" && exit 1)
	$(DEMO) up -d --build

demo-down: ## Stop the demo (keeps its database volume)
	$(DEMO) down

demo-load: ## Copy the local development database into the demo (replaces the demo data)
	$(COMPOSE) exec -T postgres pg_dump -U stintline -d stintline -Fc --no-owner \
		| $(DEMO) exec -T postgres pg_restore -U stintline -d stintline --clean --if-exists --no-owner
	$(DEMO) restart api worker

.PHONY: dev-api dev-web
dev-api: ## Run the API locally (needs Postgres and Redis, e.g. `make deps`)
	$(MANAGE) migrate
	uv run --directory apps/api uvicorn config.asgi:application --reload --port 8000

dev-web: ## Run the web dev server locally
	pnpm --filter web dev

.PHONY: deps
deps: ## Start only Postgres and Redis in Docker
	$(COMPOSE) up -d postgres redis

# ---------------------------------------------------------------- quality
.PHONY: check lint format typecheck
check: ## Lint + type checks + tests + generated types check, in parallel
	@$(MAKE) --no-print-directory -j --output-sync=target lint typecheck test types-check

lint: ## Lint Python and TypeScript
	uv run ruff check .
	uv run ruff format --check .
	pnpm -r lint
	pnpm -r format:check

format: ## Auto-format everything
	uv run ruff check --fix .
	uv run ruff format .
	pnpm -r format

typecheck: ## mypy strict + tsc
	uv run mypy
	pnpm -r typecheck

# ---------------------------------------------------------------- tests
# The API suite imports the demo races once per worker (apps/api/conftest.py): beyond four
# workers that import costs more than it saves.
PYTEST_WORKERS ?= 4

.PHONY: test test-strategy test-racedata test-api test-web test-fast e2e
test: test-strategy test-racedata test-api test-web ## Run all unit and integration tests with coverage gates

test-strategy: ## Strategy engine tests (coverage gate 90 %)
	uv run pytest packages/strategy

test-racedata: ## Provider library tests (coverage gate 85 %)
	uv run pytest packages/racedata

test-api: ## API tests (coverage gate 80 %)
	uv run pytest apps/api -n $(PYTEST_WORKERS)

test-web: ## Frontend unit tests (coverage gate 80 %)
	pnpm --filter web test

test-fast: ## Every unit test without coverage, in parallel: the quick loop while working
	@$(MAKE) --no-print-directory -j --output-sync=target \
		fast-strategy fast-racedata fast-api fast-web

.PHONY: fast-strategy fast-racedata fast-api fast-web
fast-strategy:
	uv run pytest packages/strategy -q --no-cov
fast-racedata:
	uv run pytest packages/racedata -q --no-cov
fast-api:
	uv run pytest apps/api -q --no-cov -n $(PYTEST_WORKERS)
fast-web:
	pnpm --filter web exec vitest run

e2e: ## Playwright end-to-end journeys
	pnpm --filter web e2e

# ---------------------------------------------------------------- database
.PHONY: makemigrations migrate seed
makemigrations: ## Create Django migrations
	$(MANAGE) makemigrations

migrate: ## Apply Django migrations
	$(MANAGE) migrate

seed: ## Load demo data from local fixtures (no network)
	$(MANAGE) seed_demo

# ---------------------------------------------------------------- contract
.PHONY: schema types types-check
schema: ## Export the OpenAPI schema to apps/api/openapi.yaml
	$(MANAGE) spectacular --settings config.settings.test --validate --fail-on-warn --file apps/api/openapi.yaml

types: schema ## Regenerate OpenAPI schema and TypeScript types
	pnpm --filter @stintline/api-types generate

types-check: ## Fail if the schema or generated types are stale
	$(MANAGE) spectacular --settings config.settings.test --validate --fail-on-warn --file /tmp/stintline-openapi.yaml
	diff -u apps/api/openapi.yaml /tmp/stintline-openapi.yaml
	pnpm --filter @stintline/api-types check
