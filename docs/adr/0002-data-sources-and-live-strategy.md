# 0002. Data sources, own provider library, and live strategy

- Status: Accepted
- Date: 2026-11-03
- Related: `docs/research/live-data-landscape.md`, `docs/data-sources.md`

## Context
The original plan listed three providers (OpenF1, Jolpica, FastF1) and a live mode built on OpenF1. Research in November 2026 changed the picture:
- Since ~15 Oct 2026 the official static archive returns HTTP 401 without an F1 TV token. FastF1 depends on it for 2023+ data, and cloud IPs are reportedly blocked even with a token.
- OpenF1 live data (REST, MQTT, WebSocket) requires the paid Sponsor tier (€9.90/month, personal use). Historical data is free and needs no authentication (3 req/s, 30 req/min).
- The official live timing hub (`livetiming.formula1.com/signalrcore`) still accepts **unauthenticated** connections. A probe on 2026-11-03 received a full snapshot of 20 topics (`TimingData`, `TimingAppData` with compounds and new/used flags, `TyreStintSeries`, `LapSeries`, `TrackStatus`, `RaceControlMessages`, `WeatherData`, `PitLaneTimeCollection`, `LapCount`, `SessionInfo`, `DriverList`…). Only `CarData.z` and `Position.z` were withheld. This is the approach f1-dash uses.
- formula1.com terms restrict live timing data to personal, non-commercial use.
- Budget constraint: the project must cost nothing to run.

## Decision drivers
- Zero cost, no account required for any default workflow.
- Tests and CI fully offline and reproducible.
- A public demo that does not redistribute live data.
- Strategy needs laps, stints/compounds, pit stops, track status and race control. Car telemetry and positions are not needed.

## Options considered
1. **OpenF1 + Jolpica + FastF1 (original plan).** FastF1 now needs a paid F1 TV account and is blocked in CI and the cloud. Rejected.
2. **OpenF1 Sponsor for live.** Clean API, but it costs money and is personal-use only. Rejected for now. The adapter design keeps it pluggable later.
3. **Own provider library: OpenF1 (free) + Jolpica for history, own SignalR Core client for live (chosen).**

## Decision
- Create **`packages/racedata`**, a pure-Python library with one `Provider` interface and three adapters:
  - `openf1`: historical laps, stints (tyre age at start), pit, race control, weather, intervals, drivers, sessions. Free tier, rate limited to stay under 3 req/s and 30 req/min.
  - `jolpica`: calendar, results, pit stops. Canonical for event metadata and used to cross-check OpenF1.
  - `livetiming`: our own SignalR Core client, subscribing only to unauthenticated topics. It parses the incremental feed into the same DTOs, and records raw sessions as `.jsonl` for replay and fixtures.
- **FastF1 is dropped.** What it derived (per-lap tyre life, track status per lap, accuracy flags) is recomputed from OpenF1 stints and race control in `racedata` and `strategy`.
- **Live mode runs locally only** (`docker compose` on the user's own connection). The public demo is **replay-only**, served from data already stored in the database.
- **Free fallback.** OpenF1 free data becomes available after a session (~30 min, to be measured), so ingestion can catch up after any live session.

## Consequences
- Positive: zero cost, no account needed, offline tests, and a source-agnostic engine. Building the provider library is itself a portfolio piece.
- Negative / risks:
  - The live feed is unofficial and undocumented, and F1 may gate more topics or block access. Mitigations: an adapter boundary, contract tests on recorded fixtures, graceful degradation to replay and OpenF1 catch-up.
  - Terms: live recordings stay personal. Only small trimmed fixtures are committed, with attribution, and the repo states non-affiliation.
  - OpenF1 free-tier limits make full-season backfills slow (~30 req/min). Ingestion is incremental and cached.
- Follow-ups:
  - Validate incremental feed messages during a real session (Brazilian GP, 6–8 Nov 2026) with the throwaway probe.
  - Measure OpenF1's free-tier publication delay.
  - Revisit if OpenF1 Sponsor or an official API becomes an option.
