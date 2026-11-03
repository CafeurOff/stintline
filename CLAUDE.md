# StintLine — guide for contributors and AI sessions

## What this is
StintLine is a race strategy decision-support tool built on Formula 1 timing data. It covers stint analysis, fuel-corrected tyre degradation, pit loss per circuit, undercut/overcut simulation and pit-exit position prediction, backtested against real races.
It is **not** a live timing dashboard (f1-dash, MultiViewer and F1ReplayTiming already exist), not a results or standings site, and not affiliated with Formula 1, the FIA or any team.

## Status
- Phases 0–1 done: v1 audit, data-source survey, repo baseline (this file, `.claude/`, docs, quality tooling).
- **Phase 2 has not run yet.** The code directories below and the `make` targets are the agreed target layout. Until Phase 2 lands, only `pre-commit` and the docs exist.

## Architecture
```
apps/api/            Django 5.2 LTS + DRF, Python 3.13, uv. HTTP API, ingestion, live
  config/            settings (base/dev/test/prod), urls, asgi, celery app
  stintline/racing/      ORM models: Season, Event, Session, Team, Driver, SessionEntry,
                         Lap, Stint, PitStop, RaceControlMessage, WeatherSample, TrackStatus
  stintline/ingestion/   Celery tasks: racedata DTOs -> idempotent upserts
  stintline/strategy_api/ DRF views/serializers (/api/v1/), call packages/strategy
  stintline/live/        Channels consumers, live worker, replay engine
apps/web/            React 19, TypeScript strict, Vite, Tailwind 4, TanStack Query, React Router
  src/app/ (router, providers)  src/features/<feature>/  src/components/ui/  src/lib/
packages/racedata/   Pure Python. Provider adapters (openf1, jolpica, livetiming) behind one
                     interface, HTTP client (rate limit, retry, cache, timeout), DTOs, recorder
packages/strategy/   Pure Python strategy engine (no Django, no I/O)
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

## Commands (valid from Phase 2)
| Task | Command |
| --- | --- |
| Install everything | `make setup` (`uv sync --all-packages` + `pnpm install` + `pre-commit install`) |
| Run the full stack | `make up` (`docker compose -f infra/docker-compose.yml up --build`) |
| API dev server | `make dev-api` (`uv run --package stintline-api python apps/api/manage.py runserver`) |
| Web dev server | `make dev-web` (`pnpm --filter web dev`) |
| All checks | `make check` (lint + typecheck + tests, back and front) or `/check` |
| Tests | `make test` · `uv run pytest packages/strategy` · `uv run pytest packages/racedata` · `uv run pytest apps/api` · `pnpm --filter web test` · `pnpm --filter web e2e` |
| Lint / format | `uv run ruff check .` · `uv run ruff format .` · `pnpm -r lint` · `pnpm -r format` |
| Type check | `uv run mypy` · `pnpm -r typecheck` |
| Migrations | `make makemigrations` · `make migrate` |
| OpenAPI + TS types | `make types` (`manage.py spectacular --file apps/api/openapi.yaml` then `pnpm --filter api-types generate`) |
| Demo data | `make seed` (`manage.py seed_demo`, loads 3 reference 2025 races from fixtures, no network) |
| Pre-commit | `pre-commit run --all-files` |

## Conventions
- **Language:** code, comments, identifiers, docs and commit messages in English.
- **Python:** ruff (lint + format, line length 100) and mypy strict. Modules are `snake_case`. Small modules with one responsibility. Type hints everywhere. Domain values are frozen dataclasses or pydantic models, never raw dicts past the provider boundary.
- **TypeScript:** strict mode, no `any`. Feature folders. Components are `PascalCase.tsx`, hooks are `useX.ts`. API calls go only through the client typed by `packages/api-types` and TanStack Query.
- **Errors:** providers raise typed exceptions (`ProviderError`, `RateLimited`, `UpstreamUnavailable`, `InvalidPayload`). The API maps them to RFC 7807-style JSON problems. Never return `str(exc)` to clients, never use a bare `except`.
- **Logs:** `structlog` with JSON in prod and console in dev. Log events are snake_case verbs (`ingest_session_started`) with key/value context (`session_key=…`). No `print`.
- **Time:** all datetimes are timezone-aware UTC in storage and APIs. Local circuit time is derived from the event timezone at display time only.
- **Assumptions:** every modelling assumption is a named, documented parameter with a justified default (no magic numbers). See `docs/model.md`.
- **Tests:** pytest with Arrange/Act/Assert, one behaviour per test, names like `test_<unit>_<behaviour>`. factory_boy for ORM data. Vitest and Testing Library for components, Playwright for 2–3 user journeys. **No network in tests**: upstream responses are recorded fixtures under `tests/fixtures/<provider>/` (`/new-provider-fixture`).
- **Architecture decisions:** add an ADR (`/adr`) and update this file in the same PR.

## Git rules (mandatory for every session)
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `ci:`, `build:`, `perf:`). Small, focused commits in English. No vague messages ("update", "wip", "try").
- A commit is made only when lint, type check and tests pass.
- **No AI attribution:** never add `Co-Authored-By` lines, "Generated with Claude Code" or session links to commits or PRs, unless the maintainer explicitly asks for a specific commit. `.claude/settings.json` disables automatic attribution (`attribution`, `includeCoAuthoredBy`).
- Never `git push`, force-push, rewrite history or delete branches. The maintainer does that. Never `rm -rf` outside files you just generated.

## Definition of Done
1. Lint, strict type checks and tests pass locally (`make check`) and in CI.
2. Coverage: `packages/strategy` ≥ 90 %, `apps/api` ≥ 80 % (and `packages/racedata` ≥ 85 %).
3. No network access in tests.
4. OpenAPI schema and `packages/api-types` regenerated if the API changed.
5. `CLAUDE.md`, docs and ADRs updated.
6. `make up` starts everything and the change is visible.
7. Clean Conventional Commit history with no AI attribution.

## Known pitfalls
- **Rate limits.** OpenF1 free tier allows 3 req/s and 30 req/min. Jolpica allows ~4 req/s burst and ~500 req/hour, and paginates with `limit` ≤ 100. Always go through the `racedata` HTTP client.
- **Data access.** Since Oct 2026 the official static archive (and therefore FastF1) needs an F1 TV account. We do not use FastF1. The live SignalR feed works without auth except `CarData.z` and `Position.z`, but only from a home connection (cloud IPs blocked) and for personal use. The public demo is replay-only. See `docs/adr/0002-data-sources-and-live-strategy.md`.
- **Time zones.** OpenF1 and Jolpica are UTC. Live timing `SessionInfo.StartDate` is circuit-local, with a separate `GmtOffset`. Some live timestamps are UTC. Convert at the provider boundary.
- **Laps to exclude from pace models:** lap 1, pit-in and pit-out laps, laps under SC / VSC / red flag (from race control and track status: `4` SC, `6` VSC, `7` VSC ending, `5` red), laps with null duration, and outliers (see `docs/model.md`).
- **Missing or inconsistent data.** Lap times can be null (pit-out, lap 1, deleted). Compounds can be `UNKNOWN` or null. Stint tyre age can be missing. Drivers can retire mid-stint. Sprint weekends have two races. Driver numbers are not stable identities across seasons (e.g. 33 → 1): key drivers by provider IDs and map per session.
- **Pit-stop durations.** Upstream "duration" fields mix pit-lane time (entry to exit) and stationary time depending on the source and season. Verify against fixtures, and name stored fields explicitly (`pit_lane_duration_s`, `stationary_duration_s`). Pit **loss** is computed by the strategy engine, never taken from upstream.
- **Protected assets.** No team logos, official imagery, headshots or "F1" in product naming. Team colours only.
