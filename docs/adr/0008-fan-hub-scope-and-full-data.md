# 0008. StintLine becomes a fan hub, built on every public season

- Status: Accepted (maintainer decision, 2026-11-03)
- Date: 2026-11-03
- Amends the scope in `CLAUDE.md` ("not a live dashboard, not a results site")

## Context
StintLine started as a race-strategy tool for a handful of recorded races. The maintainer now wants a complete hub for Formula 1 fans: every Grand Prix, driver profiles back to 1950, detailed post-race statistics, a what-if replay with another strategy, a full live mode with team radio, and later a news page. Accessibility for casual fans comes first; deep charts stay available for hardcore fans.

The roadmap, validated on 2026-11-03: data → hub pages and profiles → what-if replay → live → news → polish.

## Decision drivers
- Zero budget, public data only (ADR 0002).
- Upstream limits: OpenF1 30 req/min, Jolpica about 500 req/hour.
- Data must arrive without manual work after each Grand Prix.

## Options considered
### Historical results
- Separate tables for pre-timing seasons. Cons: two models for the same thing, every query doubled.
- **Reuse `Event`, `Session` and `SessionEntry`** for every season since 1950, with result columns (race time, fastest lap, Q1–Q3) and biographies on `Driver`, `Team`, `Circuit`. Pros: one query path for profiles and statistics.

### Championship tables
- Recompute from results. Cons: points systems changed many times (dropped scores, shared drives).
- **Store Jolpica standings**: after every round from 2023 (timed seasons), final table only before that, to stay within the hourly limit.

### Freshness
- Manual `ingest` after each race. Cons: forgotten, late.
- **Celery beat** (`refresh_recent` every 30 minutes, `refresh_calendar` daily): sessions are imported one hour after they finish and refreshed for three days, then results and standings of the season are refreshed.

## Decision
- Every season is stored: timing (laps, stints, pit stops, race control, weather, circuit outline, team radio references) from 2023, results, qualifying, standings and biographies from 1950.
- History is imported once with `manage.py ingest_history` (resumable); current seasons stay fresh through Celery beat.
- Team radio is stored as references to the official recordings and never re-hosted (same rule as ADR 0006). The recordings were reachable without authentication on 2026-11-03; this is re-checked before the live phase relies on it.
- News (later phase) will be generated from our own data with links to sources; scraped articles are never republished.

## Consequences
- Positive: driver careers, standings and every Grand Prix come from one model; the site stays current without manual work.
- Negative / risks: the first history import takes a few hours because of Jolpica's limit (mitigation: resumable, skips finished seasons). Early-1950s shared drives cannot be stored twice per car or driver; such rows are skipped and reported. Career statistics follow documented definitions (`stintline/racing/careers.py`) that may differ slightly from other sites.
- Follow-ups: hub pages and profiles (next phase), team pages, lap-by-lap position charts from the stored line times.
