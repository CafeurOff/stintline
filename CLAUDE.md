# StintLine — guide for contributors and AI sessions

## What this is
StintLine is a hub for Formula 1 fans built on public timing and results data (ADR 0008). Its core is race strategy: stint analysis, fuel-corrected tyre degradation, pit loss per circuit, undercut/overcut simulation and pit-exit prediction, backtested against real races, shown on the circuit. Around it: every Grand Prix since 1950, driver careers and championship tables, and later a what-if strategy replay, a live mode with team radio and a news page.
It must stay accessible to casual fans first, with deeper charts for hardcore fans. It is not affiliated with Formula 1, the FIA or any team.

## Status
- Phases 0–5 done: v1 audit, data-source survey, repo baseline, monorepo skeleton, data model and ingestion, strategy engine (see `docs/model.md`), versioned API (`/api/v1`) and a bilingual (EN/FR) web UI built around the circuit: cars replayed on the real track, pit-stop and undercut simulations drawn on it, tyres and model pages (ADR 0007, `apps/web/CLAUDE.md`).
- Phase 6 done: every season stored (timing from 2023, results, qualifying, standings and biographies from 1950), team radio references, automatic import after each Grand Prix (Celery beat), driver, standings and radio endpoints (ADR 0008).
- Phase 7 done: hub pages (home, Grands Prix by season since 1950 as cards, Grand Prix page with circuit, podium, results and race analysis: key facts, positions and gaps lap by lap, lap times, tyre strategies, best sectors and top speeds), drivers and teams as season cards with photos, line-ups and official car renders, profiles with season charts, standings with the title-fight chart, race picker dialog, photo driver picker, Wikipedia driver portraits (ADR 0009). Data stays current on its own: `refresh_recent` catches up on anything missed.
- Phase 8 done: what-if replay of a whole race with another tyre strategy (ADR 0010, `stintline_strategy.whatif`, `POST /sessions/{id}/simulate/strategy`, "Strategy" mode on the circuit with a ghost car and finishing-position chances).
- Phase 9 done: local live mode (ADR 0011). `manage.py live` (`make live`) follows the official feed, keeps the latest snapshot in Redis and streams it on `/ws/live`; `GET /api/v1/live` gives the state and the next session. `/live` page: running order, cars on the circuit, "if he pitted now" with a ghost, team radio, race control, TV delay. Recordings, `--replay` and `live_demo` (recording rebuilt from a stored race).
- Phase 10 done: news page (ADR 0012). Race and sprint reports written from our own data (facts from `stintline.news.reports`, sentences in EN/FR on the web), headlines from public RSS feeds (title and link only, `racedata.providers.feeds`), refreshed every 30 min; `/news`, `/news/:sessionId` and a news block on the home page.
- Phase 10b done: lap telemetry and journalist-style reports (ADR 0013). Fastest clean lap of every driver (OpenF1 `car_data` + `location`, bounded), `TelemetryLap`, `stintline_strategy.telemetry` (distance, braking zones, gap along the lap), `GET /sessions/{id}/telemetry[/compare]`, a Telemetry tab on the Grand Prix analysis, and reports with the race story, sections and charts.
- Phase 11 done: polish and README. Tab title per page (`useDocumentTitle`), pages loaded on demand (`React.lazy` behind a `Suspense` in the layout), phone fixes, retirements shown on driver results, faster season filters (`EXISTS`), a richer not-found page, a last-race replay link on the offline live page. README with screenshots (taken with third-party photos blocked), and a replay-only public demo with production images (`infra/docker-compose.demo.yml`, `make demo-up`, `docs/deploy.md`).
- Phase 12 done: broadcast design for the public site (ADR 0014). Sticky header with live dot, next-session countdown and phone menu; home page hero on the last Grand Prix with the podium in official photos, next Grand Prix countdown and weekend schedule, both championships, news, season strip; Grand Prix cards drawn around the circuit outline (`circuit.outline`, also for races still to come); public live page (countdown, schedule, last replay, no commands); official portraits everywhere (`photo_url`); standings leaders; telemetry zoom on any part of the lap (`?zoom=`, corner buttons, section table); model page in four steps with key figures.
- Phase 13 done: dashboard design for the whole site (ADR 0016, `docs/design.md`): icon sidebar, tiles of real figures, panels, flags, driver faces, movement arrows; dashboard home, Grand Prix page with race tiles and tagged facts, driver profile as a season dashboard, standings with moves and points share, news wire with a reader; headline pictures as URL references (ADR 0015). Next phases (paddock and FIA documents, technical, analysis hub, live, 3D lap, our own ideas, polish): `docs/plans/phases-13-20.md`.
- Phase 16 done: analysis hub (ADR 0017). Per-race figures computed once by the engine and stored (`stintline.analysis`: `RaceStats`, `EntryRaceStats`, `build_analysis`, built after each import and telemetry, stale ones by `refresh_recent`). Pages: head-to-head (every team's teammate duel or two drivers, since 1950; fuel-corrected pace gap from 2023), race pace (box plots, filters for pit and safety-car laps, cut-off, fuel-corrected switch), consistency (scatter once tyre wear is removed, map driver × race), pit stops (fastest crews, team medians, pit loss per race, undercuts that worked), track DNA (one profile per circuit and its records). Engine: `stintline_strategy.analysis` (pace filter, box plots, consistency, passes, laps led, real undercut attempts).
- Roadmap (validated 2026-11-03): Phase 7 hub (home page, calendar and archive, driver and team profiles, photo driver picker, detailed analysis pages), Phase 8 what-if strategy replay, Phase 9 live mode with team radio, Phase 10 news, Phase 11 polish and README. Each phase gets its own plan for validation. Directories marked *(planned)* below do not exist yet.

## Architecture
```
apps/api/            Django 5.2 LTS + DRF, Python 3.13, uv. HTTP API, ingestion, live
  config/            settings (base/dev/test/prod), urls, asgi, celery app
  stintline/core/        health endpoint, problem-style errors, shared API utilities
  stintline/racing/      ORM models: Season, Event, Session, Team, Driver, DriverPortrait,
                         SessionEntry, Lap, Stint, PitStop, RaceControlMessage, WeatherSample,
                         TrackStatus, TrackOutline, Standing, TeamRadio, TelemetryLap; read queries in
                         selectors.py, careers.py (driver records) and hub.py (home, teams,
                         championship progression)
  stintline/ingestion/   services (idempotent upserts), Celery tasks, `ingest` and `seed_demo` commands
  stintline/strategy_api/ ORM to engine adapter (`adapters.py`), strategy endpoints and model card, `backtest` command
  stintline/news/        headlines from news feeds (model, refresh task, `refresh_news` command),
                         race reports built from stored data (`reports.py`, race story in
                         `story.py`), news endpoints (ADR 0012, 0013)
  stintline/analysis/    per-race figures stored after each import (`build.py`), head-to-heads
                         (`duels.py`), race pace (`pace.py`), consistency and pit stops (`season.py`),
                         track DNA (`circuits.py`), analysis endpoints (ADR 0017)
  stintline/live/        live publisher (snapshot + pit now), Channels consumer `/ws/live`, `live` and
                         `live_demo` commands, circuit context from stored races (ADR 0011)
apps/web/            React 19, TypeScript strict, Vite, Tailwind 4, TanStack Query, React Router
  src/app/ (router, layout, theme)  src/features/<feature>/  src/components/{ui,racing}/  src/lib/
packages/racedata/   Pure Python, import `racedata`. Capability protocols (schedule, results, timing),
                     adapters (openf1, jolpica, wikipedia, news feeds), live timing client (`racedata.live`:
                     SignalR, merge, snapshot view, recordings), HTTP client (rate limit, retry,
                     cache, timeout), DTOs, derive/matching helpers, fixture recorder
  fixtures/          recorded upstream responses (tests + offline demo)
packages/strategy/   Strategy engine, import `stintline_strategy` (numpy + scipy, no Django, no I/O).
                     Modules: domain, laps, fuel, degradation, pit_loss, pit_exit, pace, undercut,
                     window, whatif (whole-race strategy replay), telemetry (lap traces,
                     braking zones), analysis (pace boxes, consistency, passes, undercut
                     attempts), backtest, synthetic
                     (ground-truth races for tests)
packages/api-types/  TypeScript types generated from the OpenAPI schema (never hand-edited)
infra/               docker compose (dev, and `docker-compose.demo.yml`: public replay-only demo),
                     Dockerfiles, nginx, `demo.env.example`
docs/                architecture, data sources, model, ADRs, research
```

Data flow: `providers (racedata) -> Celery ingestion -> Postgres -> strategy engine -> DRF /api/v1 -> web`.
Live flow: `livetiming SignalR (local only) -> manage.py live -> Redis (cache + channel layer) -> /ws/live -> web (TV delay)`.
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
| Ingest real data | `manage.py ingest --season 2025 [--round 14] [--sync]` (queues Celery tasks unless `--sync`; also imports the season's results and standings) |
| Ingest history | `manage.py ingest_history [--from 1950] [--to 2022] [--force]` (biographies, results, qualifying, standings; resumable) |
| Driver portraits | `manage.py ingest_portraits [--season 2025]` (Wikipedia, ADR 0009; also weekly via Celery beat) |
| Record a fixture | `uv run python -m racedata.tools.record_fixture openf1 laps session_key=9928` |
| Telemetry | `manage.py ingest_telemetry [--session ID \| --season 2025] [--sync]` (queues every race still missing it without options; also after each import and 4 older races per `refresh_recent`) |
| News headlines | `manage.py refresh_news` (also every 30 min via Celery beat and on worker start) · record a feed fixture: `uv run python -m racedata.tools.record_fixture feeds autosport` |
| Live mode (local, personal use) | `make live` (follows the feed, records to `./recordings`) · `make live-replay FILE=recordings/x.jsonl SPEED=10` · `manage.py live_demo --session 70 --out recordings/demo.jsonl` |
| Public demo (replay-only) | `cp infra/demo.env.example infra/demo.env`, then `make demo-up` (http://localhost:8080) · `make demo-load` copies the local database into it · `make demo-down` (see `docs/deploy.md`) |
| Analysis figures | `manage.py build_analysis [--season 2025 \| --session ID \| --all]` (stale races by default; also after each import and every `refresh_recent`) |
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
- **Production behind a proxy.** nginx keeps the `X-Forwarded-Proto` sent by the TLS proxy (Django redirects plain HTTP in prod), and `/api/v1/health` is exempt from the HTTPS redirect so the container health check works. A page module is lazy-loaded: in Vitest, `find*` queries wait up to 3 s (`src/test/setup.ts`), and a test must not match an element of the previous page while the next one loads.
- **Toolchain pins.** TypeScript stays on 5.9 (openapi-typescript and typescript-eslint do not support 7 yet). ESLint stays on 9 (jsx-a11y). jsdom stays on 28 (29+ needs Node ≥ 22.13 and 30 needs Node ≥ 22.22). The API client resolves `fetch` at call time so MSW can intercept it.
- **Strategy engine.** Stints can start on used tyres (`tyre_age_at_start` > 0). Pit loss already includes the out-lap new-tyre effect, so do not add it twice. Statistical tests assert calibration over many seeds, never single-seed CI containment (flaky by design).
- **Ingestion.** Only finished races and sprints get timing data (ADR 0004). Results, qualifying and standings come from Jolpica for every season (`stintline/ingestion/history.py`); never write timing-only columns (team colour, media id) from that path. OpenF1 answers empty result sets with HTTP 404: the provider turns it into an empty list. History import: `manage.py ingest_history` (resumable, a few hours because of Jolpica's limit). Celery beat runs `refresh_recent` every 30 minutes, and each worker queues it on start: it refreshes the current calendar when older than 12 h, imports every finished race or sprint never imported (catch-up after downtime) plus those finished within 3 days, then the season's results. Beat interval schedules only fire after a full interval, so never rely on a daily beat entry for freshness. Driver identity comes from Jolpica results joined on the car number raced that weekend. The Celery worker runs with `--concurrency=1` because rate limiting is in-process.
- **Coverage config** lives in the root `pyproject.toml` (coverage reads it from the working directory). Run pytest from the repository root.
- **Rate limits.** OpenF1 free tier allows 3 req/s and 30 req/min. Jolpica allows ~4 req/s burst and ~500 req/hour, and paginates with `limit` ≤ 100. Always go through the `racedata` HTTP client.
- **Data access.** Since Oct 2026 the official static archive (and therefore FastF1) needs an F1 TV account. We do not use FastF1. The live SignalR feed works without auth except `CarData.z` and `Position.z`, but only from a home connection (cloud IPs blocked) and for personal use. The public demo is replay-only. See `docs/adr/0002-data-sources-and-live-strategy.md`.
- **Time zones.** OpenF1 and Jolpica are UTC. Live timing `SessionInfo.StartDate` is circuit-local, with a separate `GmtOffset`. Some live timestamps are UTC. Convert at the provider boundary.
- **Laps to exclude from pace models:** lap 1, pit-in and pit-out laps, laps under SC / VSC / red flag (from race control and track status: `4` SC, `6` VSC, `7` VSC ending, `5` red), laps with null duration, and outliers (see `docs/model.md`).
- **Missing or inconsistent data.** Lap times can be null (pit-out, lap 1, deleted). Compounds can be `UNKNOWN` or null. Stint tyre age can be missing. Drivers can retire mid-stint. Sprint weekends have two races. Driver numbers are not stable identities across seasons (e.g. 33 → 1): key drivers by provider IDs and map per session.
- **Pit-stop durations.** Upstream "duration" fields mix pit-lane time (entry to exit) and stationary time depending on the source and season. Verify against fixtures, and name stored fields explicitly (`pit_lane_duration_s`, `stationary_duration_s`). Pit **loss** is computed by the strategy engine, never taken from upstream.
- **Circuit outlines and telemetry.** OpenF1 `location` and `car_data` are fetched only over one lap (reference lap for the outline, each driver's fastest clean lap for telemetry), always bounded with `date>` / `date<`. Never request a whole race: tens of thousands of rows per car. Outline samples are evenly spaced in time; the UI relies on that to place cars. Telemetry distance is integrated from speed (no distance channel): compare laps by fraction of lap, never by raw metres.
- **News.** Never store or show article text or summaries from feeds: headline, link and the picture URL the feed attaches to the item (ADR 0012, ADR 0015). Pictures are URL references, never downloaded, behind `NEWS_IMAGES_ENABLED`; no scraping of article pages for images. A report sentence is written only when its data exists (no race control → no safety-car claim). Bump `REPORT_FORMAT` in `stintline/news/api/views.py` when report fields change, so cached reports are rebuilt. The API container does not hot-reload: `docker compose restart api worker beat` after backend changes.
- **Protected assets.** No team logos and no "F1" in product naming. Official driver portraits and car renders are allowed only as URL references behind `OFFICIAL_MEDIA_ENABLED` (ADR 0006, on by default since ADR 0014): never download or commit them. `photo_url` on drivers is the latest official portrait (cached, key changes with each import), else Wikipedia. Wikipedia portraits (ADR 0009) are freely licensed URL references and must keep their author and licence credit.
- **Analysis figures (ADR 0017).** Bump `ANALYSIS_FORMAT` in `stintline/analysis/build.py` when a stored figure changes meaning, so every race is rebuilt. A race is wet only when intermediate or wet tyres were fitted (rain samples alone do not count). A pit loss stands for its circuit only when it is reliable (`RaceStats.pit_loss_reliable`: dry, ≥ 8 green stops, spread ≤ 25 %): Monza 2026 had a red flag missing from the timing and a 1,842 s median pit lane. Some sessions have no lap start times (Miami 2025): no running order, so passes and laps led are null, not zero.
- **Historical data gaps.** Jolpica has fastest-lap ranks only from 2004 (careers starting earlier report `null`), no qualifying for most seasons before 1994 (poles fall back to first on the grid), and gives lapped cars a time for fewer laps (show the gap in laps). OpenF1 has no pit-stop rows for the first six races of 2023.
