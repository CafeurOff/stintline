# 0013. Lap telemetry and race reports told like a journalist would

- Status: Accepted (Phase 10, 2026-11-11)

## Context
After the first news page (ADR 0012), the maintainer asked for two things: real charts of when drivers brake and accelerate, and race reports that read like a journalist's, with charts and every useful fact. OpenF1 publishes car data (speed, throttle, brake, gear, rpm, DRS) at about 3.7 Hz for free, but a whole race is ~20,000 rows per car, far beyond the free rate limit if fetched for every lap. Views never call upstream APIs, so telemetry has to be imported ahead of time.

## Decision
- **One lap per driver per race.** `stintline.ingestion.telemetry` stores the fastest clean lap of each driver (not lap 1, not a pit-in or pit-out lap) of every race and sprint since 2023: two requests per driver, `car_data` and `location`, each bounded with `date>` and `date<` to the lap (the same rule as circuit outlines). That is ~40 requests per race. Choice made with the maintainer on 2026-11-11 over "podium only" (lighter, no free comparison) and "one lap per stint" (three times heavier).
- **Storage.** `TelemetryLap` (natural key: entry + lap number) keeps the samples as compact JSON channels, seconds from the start of the lap. Re-running skips stored laps.
- **Freshness.** `ingest_session` queues `ingest_telemetry` after every import. `refresh_recent` gives telemetry to 4 older races per run (about 6 minutes of the OpenF1 budget every 30 minutes), most recent first, so a new Grand Prix is never held up behind the backlog. `manage.py ingest_telemetry [--session|--season] [--sync]` fills the rest on demand.
- **Maths in the engine.** `stintline_strategy.telemetry` (numpy, no I/O): distance from integrated speed, laps resampled every 10 m and stretched to a common length, braking zones with entry and apex speeds, time gap along the lap, full-throttle share. Every threshold is a named parameter in `docs/model.md`.
- **API.** `GET /sessions/{id}/telemetry` lists stored laps; `GET /sessions/{id}/telemetry/compare?cars=4,81` returns 1 to 3 laps on one distance grid, positions in the same screen box as the circuit drawing.
- **Web.** A "Telemetry" tab on the Grand Prix analysis: speed, throttle, brake, gear and gap panels sharing the distance axis, the lap drawn on the circuit (full throttle, braking, in between), numbered braking zones, a pointer readout and a table of braking zones as the text alternative. Charts are drawn in the page with visx (ADR 0003), chosen with the maintainer over server-rendered images.
- **Race reports.** The report facts gain the story of the race (lap-1 moves, laps led, changes of lead, how the winner took the lead for good: led every lap, regained after the stops, undercut, inherited at a rival's stop or on track), the pit stops (count, quickest stationary time), the weather, the constructors' haul, the standings after the round with changes, and the full classification. The article is split into sections (start, race, strategy, other facts, championship) and illustrated with positions and gaps lap by lap, the tyre strategies of the top ten, and the winner's fastest lap against the runner-up's.

## Consequences
- The first backfill takes about three hours of OpenF1 budget in the background; races show telemetry as soon as theirs is stored, and the tab explains when it is not yet.
- Comparing any lap other than each driver's fastest is not possible. Qualifying laps are not imported (only races and sprints have timing, ADR 0004).
- Database size grows by roughly 150 KB per race.
