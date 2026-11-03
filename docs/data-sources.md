# Data sources

What each source provides, how often, with what limits and under which terms. Decisions are in [ADR 0002](adr/0002-data-sources-and-live-strategy.md). Background research is in [research/live-data-landscape.md](research/live-data-landscape.md).

Last verified: 2026-11-03.

## Summary

| Source | Used for | Freshness | Limits | Auth | Terms |
| --- | --- | --- | --- | --- | --- |
| OpenF1 REST (free) | Historical laps, stints, pit, race control, weather, intervals, drivers, sessions (2023+) | After the session (~30 min, to be measured) | 3 req/s, 30 req/min | None | Unofficial community API, free. Data originates from FOM timing |
| Jolpica | Calendar, sessions schedule, results, pit stops, circuits (1950+) | After the session | ~4 req/s burst, ~500 req/hour (to confirm against jolpica-f1 docs). Pages of max 100 rows | None | Open-source Ergast successor, free |
| Official live timing (SignalR Core) | Live mode only, run locally | Real time (sub-second deltas) | Unknown, single connection | None for the topics we use | formula1.com terms: personal, non-commercial use. Cloud IPs reportedly blocked |
| FastF1 | **Not used** | — | Needs F1 TV account since Oct 2026 | F1 TV | — |
| FIA timing PDFs | Optional validation of pit-stop figures (Phase 4) | During and after the event | Manual | None | © FIA / FOM, use with notice |

## OpenF1
- Base URL `https://api.openf1.org/v1`. JSON or CSV. Filters on any field (`session_key=…&driver_number=…&lap_number>=10`). Dates are ISO 8601 UTC.
- Endpoints used:

  | Endpoint | Key fields |
  | --- | --- |
  | `sessions` | `session_key`, `meeting_key`, `session_type`, `session_name`, `date_start`, `date_end`, `gmt_offset`, `circuit_key`, `circuit_short_name`, `year` |
  | `drivers` | `driver_number`, `name_acronym`, `full_name`, `team_name`, `team_colour` (`headshot_url` ignored) |
  | `laps` | `lap_number`, `lap_duration`, `duration_sector_1..3`, `is_pit_out_lap`, `date_start`, `i1_speed`, `i2_speed`, `st_speed` |
  | `stints` | `stint_number`, `compound`, `lap_start`, `lap_end`, `tyre_age_at_start` |
  | `pit` | `lap_number`, `pit_duration` (pit-lane time), `date`. Newer seasons may add stationary time |
  | `race_control` | `category`, `flag`, `message`, `scope`, `sector`, `lap_number`, `date` |
  | `weather` | `air_temperature`, `track_temperature`, `humidity`, `rainfall`, `wind_speed`, `date` |
  | `intervals` | `gap_to_leader`, `interval`, `date` (race only) |

- `car_data` and `location` are not ingested (heavy and not needed for strategy).
- Free tier: no live data. Sponsor tier (live, MQTT or WebSocket) is not used (ADR 0002).
- Pitfalls: `lap_duration` is null on some laps (lap 1, pit-out, deleted). `compound` can be `UNKNOWN`. Requests that are too large return errors, so query per session and per driver.

## Jolpica
- Base URL `https://api.jolpi.ca/ergast/f1`. Ergast-compatible schema (`MRData.RaceTable…`).
- Endpoints used: `/{season}/races/`, `/{season}/{round}/results/`, `/{season}/{round}/pitstops/`, `/{season}/{round}/laps/` (cross-check), `/{season}/drivers/`, `/{season}/constructors/`.
- Session times are `date` + `time` in UTC (`Z`), and can be missing for old seasons.
- Pagination: `limit` (max 100) and `offset`. Read `MRData.total`.

## Official live timing feed (local live mode)
- Hub: `wss://livetiming.formula1.com/signalrcore` (SignalR Core, JSON protocol). An `OPTIONS` on `/signalrcore/negotiate` provides the `AWSALBCORS` cookie, then the client invokes `Subscribe([topics])`. The reply is a full snapshot, then incremental `feed` messages `[topic, payload, timestamp]` that merge into the snapshot.
- Topics we use: `SessionInfo`, `SessionStatus`, `DriverList`, `LapCount`, `TimingData`, `TimingAppData` (stints: `Compound`, `New`, `StartLaps`, `TotalLaps`), `TyreStintSeries`, `LapSeries` (position per lap), `TrackStatus` (`1` clear, `2` yellow, `4` SC, `5` red, `6` VSC, `7` VSC ending), `RaceControlMessages`, `WeatherData`, `PitLaneTimeCollection`, `ExtrapolatedClock`.
- Not available without auth: `CarData.z`, `Position.z` (not needed).
- `SessionInfo.StartDate` is circuit-local, with a separate `GmtOffset`. Convert to UTC in the adapter.
- Usage rules: run from a personal connection, for personal use. Do not redistribute recordings. The public demo never connects to this feed.

## Fixture inventory
Recorded responses used by tests and `seed_demo`. Each fixture has a `.meta.json` file (URL, params, recorded_at, sha256). Record new ones with `/new-provider-fixture`.

| Fixture | Source | Purpose |
| --- | --- | --- |
| _none yet (Phase 3)_ | | |

## Attribution
Data courtesy of [OpenF1](https://openf1.org) and [Jolpica](https://github.com/jolpica/jolpica-f1). Formula 1 timing data © Formula One World Championship Limited. StintLine is unofficial and not associated with Formula 1, the FIA or any team.
