# 0028. Practice and qualifying replays

- Status: Accepted (maintainer validated the plan on 2026-11-21)
- Date: 2026-11-21
- Amends: ADR 0004 (scope of timing imports), ADR 0013 and 0021 (telemetry of any session),
  ADR 0017 (analysis stays race-only), ADR 0026 (the replay page)

## Context
StintLine imports timing only for races and sprints (`RACE_KINDS`, ADR 0004). Practice
(FP1–FP3), qualifying (Q) and sprint qualifying (SQ) are in the calendar with their OpenF1
session key but are never imported, so a fan cannot replay them. Fans follow qualifying as
closely as the race, and practice long runs are how the paddock reads a weekend.

Three facts shape the work:
- **Identity.** Drivers come from the Jolpica classification, joined on the car number raced
  that weekend. Jolpica publishes qualifying but no practice or sprint-qualifying results, and
  FP1/FP2 run before any classification of the weekend exists.
- **No race clock.** The race replay is indexed by lap (time at the line since the start).
  In practice and qualifying cars run at different times and spend most of the session in the
  garage: the replay must follow the session's wall clock, not a lap counter.
- **Volume and access.** Non-race sessions are ~3.5 times the race sessions of a weekend, and
  ~360 of them (2023 onwards) were never imported. While any F1 session is live, OpenF1 answers
  **every** unauthenticated request with HTTP 401 ("Live F1 session in progress… restricted to
  authenticated users until the session ends"), past sessions included. Today that 401 is a
  plain `ProviderError`: the task fails and logs an error. There is no paid key (ADR 0002).

## Decision drivers
- Replays of every session kind, with nothing shown that is wrong or meaningless for it.
- Strategy, analysis and points keep their race-only meaning.
- Stay well under the OpenF1 free budget (30 req/min); never send the whole backlog at once.
- A live session must delay imports, not fail them or flood the logs.
- No new provider, zero budget.

## Options considered
### Identity of practice and sprint-qualifying entries
1. **Car number of the same weekend, else of the season's latest entry, checked against the
   driver's three-letter code (chosen).** Regular drivers keep their number for the season;
   the code check guards against a number handed to someone else.
2. Create drivers from OpenF1 names. Rejected: Jolpica ids (`max_verstappen`, `leclerc`) cannot
   be guessed, so the same person would be stored twice once they race.
3. Wait for the race classification. Rejected: FP1/FP2 replays would wait two days.

A driver never classified in a Jolpica session (a reserve in FP1 who has not raced) has no
identity: their laps are skipped and reported. The replay lists the cars it knows.

### Session replay data
1. **A new read endpoint built from stored laps on the session clock (chosen).** Laps already
   carry `started_at`; outline samples are evenly spaced in time, so a share of a lap places
   the car exactly as in the race replay.
2. Reuse the race engine context. Rejected: it models a race (fuel, stops, gaps at the line)
   and rejects sessions without a common start.

## Decision
### Two notions instead of one
`racing/models.py` gets `INGESTED_KINDS` (all seven kinds: sessions whose timing is imported)
next to `RACE_KINDS` (race and sprint: strategy, stops, analysis, points). Every use was
reviewed:

| Use | Notion |
| --- | --- |
| `ingestion/timing.py` (`is_ingestable`, `ingest_session`) | `INGESTED_KINDS` |
| `ingestion/tasks.py` (`refresh_recent`) | both: races uncapped, others capped (below) |
| `ingestion/telemetry.py` (`missing_telemetry`, `missing_altitude`), `ingest_telemetry` | `INGESTED_KINDS` |
| `analysis/build.py`, `build_analysis`, the task queued after an import | `RACE_KINDS` |
| `core/metrics.py` "races overdue" | `RACE_KINDS`; new gauge for all ingested sessions |
| strategy endpoints (`/laps`, `/replay`, `/degradation`, `/pit-loss`, simulators) | `RACE_KINDS`, 400 with a clear problem otherwise |
| web `race-picker` (`useRaces`, `RacePicker`), `PacePage`, `GrandPrixCard` | races (strategy pickers) |
| web `EventPage`, `EventHero` | every session of the weekend |

### Model
- `Lap.is_deleted`: lap time deleted by race control (track limits). OpenF1 only says so in a
  message (`CAR 1 (VER) TIME 1:23.456 DELETED - TRACK LIMITS AT TURN 4 LAP 5 …`), parsed at
  import. Deleted laps never count as a best lap and never feed telemetry.
- `RaceControlMessage.qualifying_phase` (1–3, OpenF1 `qualifying_phase`).
- `QualifyingSegment(session, number, started_at, ended_at)`, natural key
  `(session, number)`, derived from the messages of each phase (from the green light at the
  pit exit to the chequered flag: delay notices before the green light carry the phase too)
  and replaced as a whole like `TrackStatus`.

### Import
- Entries of non-race sessions: identity as in option 1; position, Q1/Q2/Q3 best times and
  laps from OpenF1 `session_result`. For Q, Jolpica stays canonical: the results import keeps
  overwriting those columns, and timing never blanks them.
- Pit records are stored for every kind (they mark pit-in laps); strategy reads them only for
  races.
- Telemetry and altitude: each car's fastest clean, non-deleted lap, as for races. For
  qualifying that is the lap that set the time.

### Replay
- `GET /sessions/{id}/timeline` (any imported session): per car, every lap with its start
  (seconds from the session start), end, time, sectors, compound, tyre age, out/in/deleted
  flags; the qualifying segments and who was eliminated in each; the flag periods, race
  control messages and weather samples on the same clock. Telemetry comes from the existing
  endpoints.
- An out lap's OpenF1 time runs from the car's previous crossing of the line, garage
  included (Alonso, Hungary 2025 Q: 774 s). A lap ends no later than the next one starts, and
  an out lap is drawn on track only for its timed sectors, each taken as a third of the lap
  (`drive_start_s`, `drive_from`); its time is not shown.
- A session without its own circuit outline (a wet practice with no clean lap, Las Vegas FP1
  2026) borrows the latest outline drawn at the same circuit.
- The page `/sessions/:id` keeps its URL. A race or sprint opens the race replay (ADR 0026); any
  other session opens a session replay: a timing tower ordered by best lap **at the replay
  instant** (gap to the fastest, laps, current tyre, in garage / on track), the qualifying
  segment and its eliminated drivers, the 2D map or 3D view, the track status and weather. The
  strategy panel, the stop simulators and the tyre-model page do not appear.
- A switcher lists the weekend's sessions. The Grand Prix page lists every session: a replay
  link when imported, "being imported" when finished but not yet imported, its start time
  otherwise. Page heads (ADR 0025) name the session; the sitemap lists imported sessions.

### Catch-up, capped
`refresh_recent` (every 30 minutes):
1. Races and sprints: unchanged (every one finished and never imported, plus the refresh
   window).
2. Other sessions that ended within `REFRESH_WINDOW` (3 days): all of them (about five per
   weekend, spread over its days).
3. Older non-race sessions never imported: at most `SESSION_BACKFILL_PER_RUN = 4` per run, the
   current season first, then earlier seasons, most recent first.

A session costs about 10 timing requests plus 2 per car for telemetry (~50 in all). Four per run
is ~200 requests every 30 minutes, under a quarter of the free budget, beside the existing
telemetry (160) and altitude (80) backfills. The ~360 sessions since 2023 take about 45 hours.

### Live-session lock
- `racedata`: HTTP 401 raises `UnauthorizedError`; the OpenF1 adapter turns a 401 whose detail
  mentions a live session into `LiveSessionLockedError` (a `ProviderError`).
- Tasks catch it, log `ingest_deferred_live_session` at info level and return: no Celery retry,
  `ingested_at` stays empty, so `refresh_recent` picks the session up again. A cache flag
  (`OPENF1_LOCK_COOLDOWN`, 10 min) stops the other queued tasks from asking again meanwhile.
- `refresh_recent` queues no OpenF1 work while a session is running according to the calendar,
  until `LIVE_LOCK_GRACE` (45 min) after its end; the calendar sync defers the same way.
  Measured on 2026-11-21: Las Vegas FP3 ended at 01:30 UTC, OpenF1 answered again between
  01:59 and 02:04.

## Consequences
- Positive: every session of a weekend can be replayed, in 2D and 3D; qualifying shows its
  segments and knock-outs; a live weekend no longer produces import errors.
- Negative / risks:
  - Database: practice has fewer laps per car than a race but the same telemetry (one lap per
    car); about 0.5 MB per session, ~200 MB for the backlog. Measured on real data in the PR.
  - Reserve drivers who never raced are missing from FP1 replays (reported at import):
    Drugovich and Aron in Hungary FP1 2025, two cars in Las Vegas FP1 2026.
  - The deleted-lap parser depends on the wording of race control messages; an unknown
    wording leaves the lap counted, and the test fixtures pin the known forms.
- Follow-ups: practice analysis (long-run pace, best lap per compound) stored per session like
  ADR 0017; reserve drivers' identity if Jolpica ever publishes practice entries.
