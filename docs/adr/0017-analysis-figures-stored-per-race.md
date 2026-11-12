# 0017. Analysis hub: figures computed once per race and stored

- Status: Accepted (maintainer validated the Phase 16 plan, 2026-11-13)
- Date: 2026-11-13

## Context
Phase 16 adds season and circuit pages: teammate and driver head-to-heads, consistency, pit
stops and the "track DNA" of every circuit. Each needs engine figures (fuel-corrected race
pace, lap-to-lap scatter, passes, laps led, pit loss, undercut outcomes, degradation) for every
race of a season or of a circuit. The engine works on one race at a time and its context is
cached in Redis for a week; building it for ~24 races on a cold cache takes several seconds per
request, and the cache is evicted with every model revision.

## Decision drivers
- Season pages must answer in well under a second, also right after a deploy.
- The engine stays pure (no Django, no I/O); figures must remain auditable and documented.
- Data keeps itself current (ADR 0008): a new race or new telemetry must show up on its own.
- Zero budget: no extra service.

## Options considered
### Compute on request, cache the response
- Pros: no new tables.
- Cons: the first visitor after an import or deploy waits for the whole season; cache misses
  pile up on circuit pages that read four seasons.

### Store the figures per race (chosen)
- Pros: season and circuit pages are plain queries; figures are rebuilt only when their inputs
  change; easy to inspect in the admin or a shell.
- Cons: two new tables and a rebuild step to keep in sync with the engine.

### Materialised SQL views
- Cons: the figures come from Python (engine), not SQL.

## Decision
A new Django app, `stintline.analysis`, stores `RaceStats` (one per race or sprint) and
`EntryRaceStats` (one per driver in it), written by `build.build_race_stats` from the cached
race context. The engine gains `stintline_strategy.analysis` (pace filter and box plots,
consistency, on-track passes, laps led, real undercut attempts), documented in `docs/model.md`.
Builds run after each session import and after telemetry is stored, `refresh_recent` queues
the stale ones (missing, older than the session's import or its telemetry, or written by an
older `ANALYSIS_FORMAT`), and `manage.py build_analysis` rebuilds on demand. Race pace with
user filters stays computed on request (`/sessions/{id}/pace`), since it depends on the filter.

Head-to-heads read results directly, so qualifying and race duels work for every season since
1950 (grid position stands in for qualifying when Jolpica has none); the pace gap exists from
2023.

## Consequences
- Positive: analysis pages answer in tens of milliseconds; new figures (undercut atlas, driver
  form) can reuse the stored rows.
- Negative / risks: stored figures go stale if the engine changes without a format bump.
  Mitigation: `ANALYSIS_FORMAT` and the stale query rebuild automatically.
- Follow-ups: Phase 19 undercut atlas and driver form read `RaceStats.undercuts` and
  `EntryRaceStats`.
