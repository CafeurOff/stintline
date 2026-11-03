# 0004. Data model and idempotent ingestion

- Status: Accepted
- Date: 2026-11-03
- Related: ADR 0002 (data sources), `apps/api/stintline/racing`, `apps/api/stintline/ingestion`

## Context
The strategy engine needs clean, joined race data: who drove which car for which team, every lap with pit-in and pit-out flags, stints with compound and tyre age, pit stops, neutralised periods and weather. This data comes from two providers (OpenF1 and Jolpica) with different identifiers and different quirks:
- driver numbers are not stable across seasons (Jolpica's `permanentNumber` shows today's number);
- pit durations measure different things depending on the source;
- Jolpica pit-stop times are circuit-local.

Imports must be safe to re-run (retries, backfills, corrections).

## Decision drivers
- Re-running any import never duplicates rows.
- Provider quirks stay at the boundary. The model is provider-neutral.
- Free-tier rate limits are respected without shared infrastructure.
- The demo works offline.

## Decision
- **Model.** `Season`, `Circuit`, `Event`, `Session`, `Team`, `Driver`, `SessionEntry`, `Lap`, `Stint`, `PitStop`, `RaceControlMessage`, `WeatherSample` and `TrackStatus`.
  - Every table has a natural-key `UniqueConstraint` (e.g. `Lap(entry, lap_number)`, `RaceControlMessage(session, digest)`).
  - Provider IDs are plain columns (`openf1_session_key`, `ref` = Jolpica id).
  - `Circuit` is added on top of the original list because pit loss is a per-circuit quantity.
  - Check constraints guard positive lap times and ordered stint bounds.
- **Identity.**
  - Drivers and teams come from the Jolpica classification. They are joined to OpenF1 timing on the **car number raced that weekend** (`Results.number`), never on the permanent number.
  - OpenF1 sessions are matched to the Jolpica calendar by kind and start time (±1 day).
- **Scope.** Timing data is ingested only for **finished races and sprints**. Other sessions are stored in the calendar only. Strategy concerns races, and the classification gives reliable identity.
- **Writes.**
  - Network calls happen first. Writes happen in one transaction per session.
  - Rows are upserted with `bulk_create(update_conflicts=True)` on natural keys.
  - `TrackStatus` is derived, so it is replaced as a whole.
  - Inconsistent rows (unknown car, inverted stint bounds, duplicate samples) are skipped or repaired and reported, never fatal.
- **Pit stops.** OpenF1 provides lane time and stationary time. Jolpica adds the stop number and its published duration, joined on (driver, lap). The pit-in lap is the lap of the pit record.
- **Tasks.** `ingest_season`, `ingest_event` and `ingest_session` are idempotent Celery tasks. They auto-retry on `UpstreamUnavailableError` and `RateLimitedError` with exponential back-off and jitter. Rate limiting is in-process, so the worker runs with `--concurrency=1`.
- **Demo.** `manage.py seed_demo` loads the 2025 calendar plus the Bahrain, Hungarian and Italian Grands Prix from fixtures in `packages/racedata/fixtures/` (offline, idempotent).

## Consequences
- Positive: Safe re-runs, offline demo and tests, and a provider-agnostic schema ready for the strategy engine.
- Negative:
  - Practice and qualifying timing is not ingested yet.
  - A single ingestion worker limits throughput, which is acceptable at ~7 requests per session.
- Follow-ups:
  - A Redis-backed limiter if ingestion ever needs parallel workers.
  - Ingest qualifying when a feature needs it.
  - Live ingestion in Phase 6 will reuse the same upsert paths.
