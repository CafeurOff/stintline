# StintLine — guide for contributors and AI sessions

## What this is
StintLine is a site for Formula 1 fans built on public timing and results data (ADR 0008). Its core is race strategy: stint analysis, fuel-corrected tyre degradation, pit loss per circuit, undercut/overcut simulation, pit-exit prediction and what-if replays, backtested against real races and shown on the circuit. Around it: every Grand Prix since 1950, careers and standings, analysis pages, FIA documents, telemetry, news and a local live mode.
It must stay accessible to casual fans first, with deeper charts for hardcore fans. It is not affiliated with Formula 1, the FIA or any team.

## Status
Every feature listed above is built and tested. How it got there, phase by phase, and the ideas not built yet are in `docs/history.md`. Design rules are in `docs/design.md` (ADR 0023), the model in `docs/model.md`.

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
  stintline/ingestion/   idempotent upserts: calendar (`schedule.py`), session timing (`timing.py`),
                         history (`history.py`), telemetry, portraits, shared writers
                         (`services.py`); Celery tasks, `ingest` and `seed_demo` commands
  stintline/strategy_api/ ORM to engine adapter (`adapters.py`), strategy endpoints (`services.py`), model card (`model_card.py`), `backtest` command
  stintline/news/        headlines from news feeds (model, refresh task, `refresh_news` command),
                         race reports built from stored data (`reports.py`, race story in
                         `story.py`), news endpoints (ADR 0012, 0013)
  stintline/analysis/    per-race figures stored after each import (`build.py`), head-to-heads
                         (`duels.py`), race pace (`pace.py`), consistency and pit stops (`season.py`),
                         track DNA (`circuits.py`), analysis endpoints (ADR 0017)
  stintline/paddock/     FIA documents and stewards' decisions: import (`services.py`, `refresh.py`),
                         shared fia.com slot (`throttle.py`), PDF relay (`relay.py`), search and
                         decisions (`selectors.py`), endpoints (ADR 0018)
  stintline/technical/   upgrades, power-unit elements and incidents read from FIA technical
                         documents (`reading.py`, registered as paddock readers; `selectors.py`,
                         `read_technical`), technical endpoints (ADR 0019)
  stintline/live/        live publisher (snapshot + pit now + session history), Channels consumer
                         `/ws/live`, `live` and `live_demo` commands, circuit context from stored
                         races (ADR 0011, 0020)
  stintline/championship/ title maths (ADR 0022): points rules per season (`rules.py`), pure
                         arithmetic (`maths.py`), tallies from stored results (`selectors.py`),
                         `check_title_rules`, title endpoint
  stintline/forecast/    Open-Meteo forecasts of upcoming sessions: refresh (`services.py`),
                         Celery task, `refresh_forecasts`, endpoint (ADR 0020)
  stintline/seo/         web pages with their head (ADR 0025): route descriptions (`pages.py`),
                         index.html rendering with canonical, hreflang, previews, JSON-LD and
                         preloads (`document.py`), `sitemap.xml`, `robots.txt`, real 404s
apps/web/            React 19, TypeScript strict, Vite, Tailwind 4, TanStack Query, React Router
  src/app/ (router, layout, theme)  src/features/<feature>/  src/components/{ui,racing}/  src/lib/
packages/racedata/   Pure Python, import `racedata`. Capability protocols (schedule, results, timing),
                     adapters (openf1, jolpica, wikipedia, news feeds, fia documents, open-meteo), live timing client (`racedata.live`:
                     SignalR, merge, snapshot view, recordings), HTTP client (rate limit, retry,
                     cache, timeout), DTOs, derive/matching helpers, fixture recorder
  fixtures/          recorded upstream responses (tests + offline demo)
packages/strategy/   Strategy engine, import `stintline_strategy` (numpy + scipy, no Django, no I/O).
                     Modules: domain, laps, fuel, degradation, pit_loss, pit_exit, pace, undercut,
                     window, whatif (whole-race strategy replay), telemetry (lap traces, altitude,
                     braking zones), analysis (pace boxes, consistency, passes, undercut
                     attempts), backtest, synthetic
                     (ground-truth races for tests)
packages/api-types/  TypeScript types generated from the OpenAPI schema (never hand-edited)
infra/               docker compose (dev, and `docker-compose.demo.yml`: public replay-only demo),
                     Dockerfiles, nginx, `demo.env.example`
docs/                architecture, data sources, model, design, deploy, history, ADRs, research
```

Data flow: `providers (racedata) -> Celery ingestion -> Postgres -> strategy engine -> DRF /api/v1 -> web`.
Live flow: `livetiming SignalR (local only) -> manage.py live -> Redis (cache + channel layer) -> /ws/live -> web (TV delay)`.
Details: `docs/architecture.md`, `docs/data-sources.md`, `docs/adr/`.

Hard boundaries:
- Views and the strategy engine never call upstream APIs, except the two cached relays (FIA PDFs, Wikipedia portraits). Only `racedata` does network I/O.
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
| All checks | `make check` (lint + typecheck + tests + schema/types drift, in parallel, about a minute) or `/check` |
| Tests | `make test-fast` (everything, no coverage, ~20 s) · `make test` (with coverage gates) · `uv run pytest packages/strategy` · `uv run pytest packages/racedata` · `uv run pytest apps/api -n 4` · `pnpm --filter web test` · `pnpm --filter web e2e` |
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
| Telemetry | `manage.py ingest_telemetry [--session ID \| --season 2025] [--sync]` (queues every race still missing it without options; also after each import and 4 older races per `refresh_recent`) · `--altitude` fetches positions again for laps stored without altitude (ADR 0021) |
| News headlines | `manage.py refresh_news` (also every 30 min via Celery beat and on worker start) · record a feed fixture: `uv run python -m racedata.tools.record_fixture feeds autosport` |
| Live mode (local, personal use) | `make live` (follows the feed, records to `./recordings`) · `make live-replay FILE=recordings/x.jsonl SPEED=10` · `manage.py live_demo --session 70 --out recordings/demo.jsonl` |
| Public demo (replay-only) | `cp infra/demo.env.example infra/demo.env`, then `make demo-up` (http://localhost:8080) · `make demo-load` copies the local database into it · `make demo-down` (see `docs/deploy.md`) |
| Analysis figures | `manage.py build_analysis [--season 2025 \| --session ID \| --all]` (stale races by default; also after each import and every `refresh_recent`) |
| FIA documents | `manage.py ingest_fia [--season 2026] [--texts 200] [--all-events]` (1 request / 10 s; also every 30 min via Celery beat) · record a fixture: `uv run python -m racedata.tools.record_fixture fia "<season page>/event/Hungarian Grand Prix"` |
| Technical documents | `manage.py read_technical [--season 2026] [--limit 50] [--all]` (re-read upgrades and power-unit PDFs after a parser change; 1 request / 10 s) |
| Title maths | `manage.py check_title_rules [--season 1988]` (recounts seasons with our points rules and lists drivers whose total differs from the official standings) |
| Weather forecasts | `manage.py refresh_forecasts` (sessions within 15 days; also every 3 h via Celery beat and on worker start) |
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
- **Branches and pull requests:** `main` is protected and needs the maintainer's approval. Work on a branch, open a pull request, never merge it yourself. Never force-push, rewrite history, delete branches or tags, or push tags.
- Never `rm -rf` outside files you just generated.

## Definition of Done
1. Lint, strict type checks and tests pass locally (`make check`) and in CI.
2. Coverage: `packages/strategy` ≥ 90 %, `packages/racedata` ≥ 85 %, `apps/api` ≥ 80 %, `apps/web` ≥ 80 %.
3. No network access in tests.
4. OpenAPI schema and `packages/api-types` regenerated if the API changed.
5. `CLAUDE.md`, docs and ADRs updated.
6. `make up` starts everything and the change is visible.
7. Clean Conventional Commit history with no AI attribution.

## Known pitfalls
- **Production behind a proxy.** nginx keeps the `X-Forwarded-Proto` sent by the TLS proxy (Django redirects plain HTTP in prod), and `/api/v1/health` is exempt from the HTTPS redirect so the container health check works. A page module is lazy-loaded: in Vitest, `find*` queries wait up to 5 s (`src/test/setup.ts`), and a test must not match an element of the previous page while the next one loads.
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
- **Circuit outlines and telemetry.** OpenF1 `location` and `car_data` are fetched only over one lap (reference lap for the outline, each driver's fastest clean lap for telemetry), always bounded with `date>` / `date<`. Never request a whole race: tens of thousands of rows per car. Outline samples are evenly spaced in time; the UI relies on that to place cars. Telemetry distance is integrated from speed (no distance channel): compare laps by fraction of lap, never by raw metres. Altitude `z` is in the plane's units (about decimetres); turn it into metres with `plane_scale`, never by assuming the unit (ADR 0021).
- **News.** Never store or show article text or summaries from feeds: headline, link and the picture URL the feed attaches to the item (ADR 0012, ADR 0015). Pictures are URL references, never downloaded, behind `NEWS_IMAGES_ENABLED`; no scraping of article pages for images. A report sentence is written only when its data exists (no race control → no safety-car claim). Bump `REPORT_FORMAT` in `stintline/news/api/views.py` when report fields change, so cached reports are rebuilt. The API container does not hot-reload: `docker compose restart api worker beat` after backend changes.
- **Protected assets.** No team logos and no "F1" in product naming. Official driver portraits and car renders are allowed only as URL references behind `OFFICIAL_MEDIA_ENABLED` (ADR 0006, on by default since ADR 0014): never download or commit them. `photo_url` on drivers is the latest official portrait (cached, key changes with each import), else Wikipedia. Wikipedia portraits (ADR 0009) are freely licensed and must keep their author and licence credit; the API relays their thumbnails from our origin (`GET /drivers/{ref}/portrait`, `stintline.racing.portraits`, a week in the cache, never stored) so pages set no Wikimedia cookies (ADR 0024). This relay and the FIA PDF relay are the only views that reach upstream.
- **Analysis figures (ADR 0017).** Bump `ANALYSIS_FORMAT` in `stintline/analysis/build.py` when a stored figure changes meaning, so every race is rebuilt. A race is wet only when intermediate or wet tyres were fitted (rain samples alone do not count). A pit loss stands for its circuit only when it is reliable (`RaceStats.pit_loss_reliable`: dry, ≥ 8 green stops, spread ≤ 25 %): Monza 2026 had a red flag missing from the timing and a 1,842 s median pit lane. Some sessions have no lap start times (Miami 2025): no running order, so passes and laps led are null, not zero.
- **FIA documents (ADR 0018).** fia.com allows one request per 10 s (robots.txt): every call goes through `paddock.throttle` (a Redis slot shared by the worker and the API), never around it. The PDF relay and the portrait relay (ADR 0024) are the only views that can reach upstream; the PDF is cached a week and a reader goes before the import. "Published on … CET" is Paris wall-clock time. FIA event names differ from ours (`services.match_event`). The decision `Time` is when the stewards noted the incident. PDFs are never stored; the extracted text is. `pdfjs-dist` stays on 4.x (5+ needs Node 22.13). A `sr-only` element must not sit inside an unpositioned scroll wrapper (see `apps/web/CLAUDE.md`).
- **Technical documents (ADR 0019).** Teams lay out their own upgrade pages: rows start with a number, descriptions continue in the same column; picture-only pages are skipped. Never strip images from an upgrades PDF fixture (table borders go with them). Power-unit columns are placed by x position; allowances come from the FIA's sentences only. A reader registers in `AppConfig.ready` (`paddock.readers.register`).
- **Weather and live tower (ADR 0020).** Open-Meteo data is CC BY 4.0: show `ForecastCredit` wherever a forecast appears. Forecast times are requested in GMT (UTC). The Open-Meteo fixture is hand-built from the documented format: re-record it when the network is available. Flag periods come from `SessionData.StatusSeries`, which also lists earlier sessions of the weekend (dropped from 30 min before the start). Pit-lane times disappear from `PitLaneTimeCollection`: `SessionHistory` keeps them, and loses them if the live process restarts.
- **Title maths (ADR 0022).** Points rules live in `stintline/championship/rules.py`: add a line when a season's rules change, then run `check_title_rules`. Jolpica's standings are wrong for 1967 (Brabham 48, officially 46) and 1977 (Lauda 70 and Reutemann 41, officially 72 and 42): trust the recount. Before 1958 shared drives and shared fastest laps are missing from race results (totals 1–5 points short). A tie is never "settled" unless the countback is sure.
- **Page heads and languages (ADR 0025).** nginx serves files and sends every other path to the API, which renders the built index.html with the page's head (`stintline.seo`). French pages live under `/fr` (router basename); the language comes from the address. A new route in `apps/web/src/app/router.tsx` needs a line in `seo/pages.py` (else the server answers 404) and in `seo/document.py` `PAGE_MODULES`. The API prod image is built with the web image as its `web` build context. French Grand Prix names live in `apps/web/src/lib/i18n/event-names.fr.json`, shared by both.
- **Historical data gaps.** Jolpica has fastest-lap ranks only from 2004 (careers starting earlier report `null`), no qualifying for most seasons before 1994 (poles fall back to first on the grid), and gives lapped cars a time for fewer laps (show the gap in laps). OpenF1 has no pit-stop rows for the first six races of 2023.
