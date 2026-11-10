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
check: lint typecheck test types-check ## Lint + type checks + tests + generated types check

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
.PHONY: test test-strategy test-racedata test-api test-web e2e
test: test-strategy test-racedata test-api test-web ## Run all unit and integration tests

test-strategy: ## Strategy engine tests (coverage gate 90 %)
	uv run pytest packages/strategy

test-racedata: ## Provider library tests (coverage gate 85 %)
	uv run pytest packages/racedata

test-api: ## API tests (coverage gate 80 %)
	uv run pytest apps/api

test-web: ## Frontend unit tests
	pnpm --filter web test

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
