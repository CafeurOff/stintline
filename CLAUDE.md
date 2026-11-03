# StintLine — guide for contributors and AI sessions

## What this is
StintLine is a race strategy decision-support tool built on Formula 1 timing data. It covers stint analysis, fuel-corrected tyre degradation, pit loss per circuit, undercut/overcut simulation and pit-exit position prediction, backtested against real races.
It is **not** a live timing dashboard (f1-dash, MultiViewer and F1ReplayTiming already exist), not a results or standings site, and not affiliated with Formula 1, the FIA or any team.

## Status
- Phases 0–4 done: v1 audit, data-source survey, repo baseline, monorepo skeleton, data model and ingestion, strategy engine (cleaning, fuel, degradation, pit loss, pit exit, undercut/overcut, pit window, backtest; see `docs/model.md`).
- Next: Phase 5 (API and UI). Directories marked *(planned)* below do not exist yet.

## Architecture
```
apps/api/            Django 5.2 LTS + DRF, Python 3.13, uv. HTTP API, ingestion, live
  config/            settings (base/dev/test/prod), urls, asgi, celery app
  stintline/core/        health endpoint, problem-style errors, shared API utilities
  stintline/racing/      ORM models: Season, Event, Session, Team, Driver, SessionEntry,
                         Lap, Stint, PitStop, RaceControlMessage, WeatherSample, TrackStatus
  stintline/ingestion/   services (idempotent upserts), Celery tasks, `ingest` and `seed_demo` commands
  stintline/strategy_api/ ORM to engine adapter (`adapters.py`), `backtest` command; DRF views planned (Phase 5)
  stintline/live/        (planned) Channels consumers, live worker, replay engine
apps/web/            React 19, TypeScript strict, Vite, Tailwind 4, TanStack Query, React Router
  src/app/ (router, providers)  src/features/<feature>/  src/components/ui/  src/lib/
packages/racedata/   Pure Python, import `racedata`. Capability protocols (schedule, results, timing),
                     adapters (openf1, jolpica; livetiming planned), HTTP client (rate limit, retry,
                     cache, timeout), DTOs, derive/matching helpers, fixture recorder
  fixtures/          recorded upstream responses (tests + offline demo)
packages/strategy/   Strategy engine, import `stintline_strategy` (numpy + scipy, no Django, no I/O).
                     Modules: domain, laps, fuel, degradation, pit_loss, pit_exit, pace, undercut,
                     window, backtest, synthetic (ground-truth races for tests)
packages/api-types/  TypeScript types generated from the OpenAPI schema (never hand-edited)
infra/               docker compose, Dockerfiles, nginx, deploy config
docs/                architecture, data sources, model, ADRs, research
```

Data flow: `providers (racedata) -> Celery ingestion -> Postgres -> strategy engine -> DRF /api/v1 -> web`.
Live flow: `livetiming SignalR (local only) -> live worker -> Postgres + Redis -> Channels WebSocket -> web`.
Details: `docs/architecture.md`, `docs/data-sources.md`, `docs/adr/`.

Hard boundaries:
- Views and the strategy engine never call upstream APIs. Only `racedata` does network I/O.
- `packages/strategy` never imports Django or `racedata`. It takes plain typed inputs.
- `packages/api-types` is generated output.

## Commands
Prerequisites: uv ≥ 0.9, Node ≥ 22.12 with pnpm 10, Docker with Compose v2. `make help` lists every target.

| Task | Command |
| --- | --- |
| Install everything | `make setup` (`uv sync --all-packages`, `pnpm install`, Playwright Chromium, `pre-commit install`, `.env`) |
| Run the full stack | `make up` → web http://localhost:5173, API http://localhost:8000/api/v1/health, docs http://localhost:8000/api/docs/ |
| API dev server | `make deps` (Postgres + Redis in Docker), then `make dev-api` (migrate + uvicorn on :8000) |
| Web dev server | `make dev-web` (`pnpm --filter web dev`) |
| All checks | `make check` (lint + typecheck + tests + schema/types drift) or `/check` |
| Tests | `make test` · `uv run pytest packages/strategy` · `uv run pytest packages/racedata` · `uv run pytest apps/api` · `pnpm --filter web test` · `pnpm --filter web e2e` |
| Lint / format | `uv run ruff check .` · `uv run ruff format .` · `pnpm -r lint` · `pnpm -r format` |
| Type check | `uv run mypy` · `pnpm -r typecheck` |
| Migrations | `make makemigrations` · `make migrate` |
| OpenAPI + TS types | `make types` (export `apps/api/openapi.yaml`, regenerate `packages/api-types`) · drift check: `make types-check` |
| Demo data | `make seed` (`manage.py seed_demo`: 2025 calendar plus Bahrain, Hungary and Italy races from fixtures, no network, idempotent) |
| Backtest | `manage.py seed_demo --backtest` then `manage.py backtest [--rounds 3 9 ...] [--json out.json]` |
| Ingest real data | `manage.py ingest --season 2025 [--round 14] [--sync]` (queues Celery tasks unless `--sync`) |
| Record a fixture | `uv run python -m racedata.tools.record_fixture openf1 laps session_key=9928` |
| Pre-commit | `pre-commit run --all-files` |

## Conventions
- **Language:** code, comments, identifiers, docs and commit messages in English.
- **Python:** ruff (lint + format, line length 100) and mypy strict. Modules are `snake_case`. Small modules with one responsibility. Type hints everywhere. Domain values are frozen dataclasses or pydantic models, never raw dicts past the provider boundary.
- **Charts:** visx (ADR 0003).
- **TypeScript:** strict mode, no `any`. Feature folders. Components are `PascalCase.tsx`, hooks are `useX.ts`. API calls go only through the client typed by `packages/api-types` and TanStack Query.
- **Errors:** providers raise typed exceptions (`ProviderError`, `RateLimited`, `UpstreamUnavailable`, `InvalidPayload`). The API maps them to RFC 7807-style JSON problems. Never return `str(exc)` to clients, never use a bare `except`.
- **Logs:** `structlog` with JSON in prod and console in dev. Log events are snake_case verbs (`ingest_session_started`) with key/value context (`session_key=…`). No `print`.
- **Time:** all datetimes are timezone-aware UTC in storage and APIs. Local circuit time is derived from the event timezone at display time only.
- **Assumptions:** every modelling assumption is a named, documented parameter with a justified default (no magic numbers). See `docs/model.md`. Never tune on the held-out backtest races (Japan, Spain, Austria, Netherlands, Mexico City, Abu Dhabi 2025). Tune on Bahrain, Hungary and Italy only.
- **Tests:** pytest with Arrange/Act/Assert, one behaviour per test, names like `test_<unit>_<behaviour>`. factory_boy for ORM data. Vitest and Testing Library for components, Playwright for 2–3 user journeys. **No network in tests**: upstream responses are recorded fixtures under `packages/racedata/fixtures/` served by `FixtureTransport` (`/new-provider-fixture`). Test doubles (`FakeClock`, `sequence_transport`) live in `racedata.testing`.
- **Architecture decisions:** add an ADR (`/adr`) and update this file in the same PR.

## Git rules (mandatory for every session)
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `ci:`, `build:`, `perf:`). Small, focused commits in English. No vague messages ("update", "wip", "try").
- A commit is made only when lint, type check and tests pass.
- **No AI attribution:** never add `Co-Authored-By` lines, "Generated with Claude Code" or session links to commits or PRs, unless the maintainer explicitly asks for a specific commit. `.claude/settings.json` disables automatic attribution (`attribution`, `includeCoAuthoredBy`).
- **Push policy (foundation stage, granted by the maintainer on 2026-11-03):** a plain `git push origin main` is allowed once checks pass. Never force-push, rewrite history, delete branches or tags, or push tags. This permission ends when the maintainer says the foundation stage is over. From then on, work goes through branches and PRs.
- Never `rm -rf` outside files you just generated.

## Definition of Done
1. Lint, strict type checks and tests pass locally (`make check`) and in CI.
2. Coverage: `packages/strategy` ≥ 90 %, `apps/api` ≥ 80 % (and `packages/racedata` ≥ 85 %).
3. No network access in tests.
4. OpenAPI schema and `packages/api-types` regenerated if the API changed.
5. `CLAUDE.md`, docs and ADRs updated.
6. `make up` starts everything and the change is visible.
7. Clean Conventional Commit history with no AI attribution.

## Known pitfalls
- **Toolchain pins.** TypeScript stays on 5.9 (openapi-typescript and typescript-eslint do not support 7 yet). ESLint stays on 9 (jsx-a11y). jsdom stays on 28 (29+ needs Node ≥ 22.13 and 30 needs Node ≥ 22.22). The API client resolves `fetch` at call time so MSW can intercept it.
- **Strategy engine.** Stints can start on used tyres (`tyre_age_at_start` > 0). Pit loss already includes the out-lap new-tyre effect, so do not add it twice. Statistical tests assert calibration over many seeds, never single-seed CI containment (flaky by design).
- **Ingestion.** Only finished races and sprints get timing data (ADR 0004). Driver identity comes from Jolpica results joined on the car number raced that weekend. The Celery worker runs with `--concurrency=1` because rate limiting is in-process.
- **Coverage config** lives in the root `pyproject.toml` (coverage reads it from the working directory). Run pytest from the repository root.
- **Rate limits.** OpenF1 free tier allows 3 req/s and 30 req/min. Jolpica allows ~4 req/s burst and ~500 req/hour, and paginates with `limit` ≤ 100. Always go through the `racedata` HTTP client.
- **Data access.** Since Oct 2026 the official static archive (and therefore FastF1) needs an F1 TV account. We do not use FastF1. The live SignalR feed works without auth except `CarData.z` and `Position.z`, but only from a home connection (cloud IPs blocked) and for personal use. The public demo is replay-only. See `docs/adr/0002-data-sources-and-live-strategy.md`.
- **Time zones.** OpenF1 and Jolpica are UTC. Live timing `SessionInfo.StartDate` is circuit-local, with a separate `GmtOffset`. Some live timestamps are UTC. Convert at the provider boundary.
- **Laps to exclude from pace models:** lap 1, pit-in and pit-out laps, laps under SC / VSC / red flag (from race control and track status: `4` SC, `6` VSC, `7` VSC ending, `5` red), laps with null duration, and outliers (see `docs/model.md`).
- **Missing or inconsistent data.** Lap times can be null (pit-out, lap 1, deleted). Compounds can be `UNKNOWN` or null. Stint tyre age can be missing. Drivers can retire mid-stint. Sprint weekends have two races. Driver numbers are not stable identities across seasons (e.g. 33 → 1): key drivers by provider IDs and map per session.
- **Pit-stop durations.** Upstream "duration" fields mix pit-lane time (entry to exit) and stationary time depending on the source and season. Verify against fixtures, and name stored fields explicitly (`pit_lane_duration_s`, `stationary_duration_s`). Pit **loss** is computed by the strategy engine, never taken from upstream.
- **Protected assets.** No team logos and no "F1" in product naming. Official driver portraits and car renders are allowed only as URL references behind `OFFICIAL_MEDIA_ENABLED` (ADR 0006): never download or commit them.
