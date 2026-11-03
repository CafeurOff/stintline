# 0001. Monorepo layout and technology stack

- Status: Accepted
- Date: 2026-11-03

## Context
v1 was a two-folder prototype (Django proxy + React JSX) with no tests, no typing and no shared contract between back and front (see `docs/v1-audit.md`). v2 must look like an engineering-tools product: a strategy engine that can be tested in isolation, a typed API contract, reproducible environments and a single-command start. It is maintained by one developer.

## Decision drivers
- Strategy maths testable without a web framework or a database.
- A single typed contract from backend to frontend, checked in CI.
- Background ingestion and real-time push (live and replay).
- Low operational overhead for a solo maintainer. One repo, one command.

## Options considered
### A. Monorepo: Django/DRF + Celery + Channels, pure-Python packages, React/TS (chosen)
- Pros: Django admin, ORM, migrations and DRF maturity. drf-spectacular gives a solid OpenAPI schema. Celery and Channels cover ingestion and WebSockets in the same codebase. Pure-Python packages keep the engine framework-free. One CI and atomic cross-cutting changes.
- Cons: Several runtimes (ASGI, worker, beat). Django is heavier than a micro-framework.

### B. FastAPI + separate workers
- Pros: Native async, pydantic-first, less boilerplate.
- Cons: No admin or migrations out of the box. More glue for auth, admin and background jobs. The v1 Django knowledge is not reused.

### C. Polyrepo (engine, API, web separately)
- Pros: Independent versioning.
- Cons: Cross-repo changes and contract drift, too much overhead for one maintainer.

## Decision
A single monorepo:
- `apps/api`: Django 5.2 LTS + DRF, Python 3.13, uv, Celery, Channels, drf-spectacular, structlog, ruff, mypy strict, pytest + pytest-django + factory_boy.
- `apps/web`: React 19, TypeScript strict, Vite, Tailwind 4, TanStack Query, React Router, ESLint, Prettier, Vitest, Testing Library, Playwright.
- `packages/strategy` and `packages/racedata`: pure Python.
- `packages/api-types`: openapi-typescript output, verified in CI.
- `infra/`: docker compose (postgres, redis, api, worker, beat, web).

Python packages form a **uv workspace**, and JS packages form a **pnpm workspace**. A root `Makefile` gives the common entry points.

## Consequences
- Positive: The engine can be unit-tested and benchmarked alone. Schema drift fails CI. `make up` runs the whole system.
- Negative: Two package managers (uv and pnpm). This is mitigated by the Makefile and `make setup`.
- Follow-ups: The charting library choice (Recharts vs visx) gets its own ADR in Phase 2. So does the numerical stack of `packages/strategy` (pure Python vs numpy/scipy) in Phase 4.
