# Live and historical data landscape (November 2026)

Survey of every known way to obtain Formula 1 timing, strategy and driver data, official or not, API or not. It was done before designing ingestion and live mode.
It feeds `docs/data-sources.md` (Phase 1) and the provider ADR (Phase 3).

Snapshot date: 2026-11-03. This ecosystem changes often (see the October 2026 archive lockdown below). Re-check before relying on any limit or price quoted here.

## 1. Summary

| Source | Live? | Historical? | Auth / cost | Usable for a public hosted demo? |
| --- | --- | --- | --- | --- |
| OpenF1 REST | Paid tier only | Yes, free | Free: 3 req/s, 30 req/min. Sponsor (€9.90/month, "personal use"): 6 req/s, 60 req/min | Historical: yes. Live: no (personal-use tier) |
| OpenF1 MQTT / WebSocket | Yes | — | Sponsor OAuth2 token. `mqtt.openf1.org:8883` (TLS), `wss://mqtt.openf1.org:8084/mqtt` | No (personal use). Broker outages reported in 2026 |
| Jolpica (Ergast successor) | No (updated after sessions) | Yes, 1950→ | Free. ~4 req/s burst, ~500 req/hour sustained (secondary source) | Yes |
| Official F1 live timing (SignalR Core, `livetiming.formula1.com/signalrcore`) | Yes | — | Car telemetry and position topics need an F1 TV subscription token. Cloud IPs reportedly blocked | No: personal, non-commercial use only under formula1.com terms |
| Official F1 static archive (`livetiming.formula1.com/static`) | — | Yes | **401 without F1 TV token since ~15 Oct 2026** | No |
| FastF1 (Python library) | Records live (SignalR client) | Yes, via the static archive | Since Oct 2026 needs F1 TV credentials for 2023+ data. Mirror only covers 2021–2022 | Not on cloud servers, not in CI |
| TracingInsights datasets (GitHub `TracingInsights/<year>`, `tif1` client) | No (~30 min after session) | Yes, lap + 3.7 Hz telemetry JSON | Free. Data stated Apache-2.0 (verify LICENSE), derived from FastF1 / MultiViewer / Jolpica | Possibly, but upstream provenance is unclear |
| FIA timing PDFs (fia.com documents) | No (published during/after sessions) | Yes | Free. Copyright FIA/FOM, use allowed if notice kept | As a validation reference, not as a redistributed dataset |
| Open-Meteo (weather forecast) | Forecast | Yes (archive) | Free, CC-BY 4.0 | Yes |

## 2. Details

### 2.1 OpenF1
- REST endpoints relevant to strategy: `sessions`, `meetings`, `drivers`, `laps`, `stints`, `pit`, `race_control`, `weather`, `intervals`, `position`, `team_radio`, plus `car_data` and `location` (high-frequency, heavy).
- Free tier: historical data only, 3 req/s and 30 req/min, no auth.
- Sponsor tier (€9.90/month, labelled "Personal use"): live data during sessions over REST, MQTT and WebSocket, 6 req/s and 60 req/min, up to 10 concurrent streaming connections. Auth is OAuth2: the access token is the MQTT password, and any non-empty username works.
- Reliability: GitHub discussion br-g/openf1#424 reports the MQTT/WebSocket broker unreachable for some users, confirmed by the maintainer in June 2026. REST polling must stay available as the fallback.
- Source: <https://openf1.org/>, <https://openf1.org/auth.html>, <https://github.com/br-g/openf1/discussions/424>.

### 2.2 Official F1 live timing feed
- Transport moved from classic SignalR to SignalR Core (`/signalrcore`) in 2025. Topics include `TimingData`, `TimingAppData` (stints, compounds), `TrackStatus`, `RaceControlMessages`, `WeatherData`, `PitLaneTimeCollection`, `CarData.z`, `Position.z`.
- `CarData.z` and `Position.z` are only sent to connections authenticated with an F1 TV subscription token.
- Since ~15 October 2026 the static archive (`/static/<year>/…`, including `Index.json`) returns HTTP 401 without a token. This breaks FastF1, undercut-f1 and others for uncached sessions (Fast-F1#978).
- formula1.com terms: site material, including live timing data, is for personal, non-commercial use. Redistribution and extraction are not permitted.
- Clients: FastF1 `fastf1.livetiming` (records to file, not real-time analysis), LiveF1 (Python), eXhumer/f1-live-timing (TypeScript), f1-dash (records and replays the socket with `data-saver` / `data-simulator`).
- Sources: <https://github.com/theOehrly/Fast-F1/issues/753>, <https://github.com/theOehrly/Fast-F1/issues/978>, <https://docs.fastf1.dev/api_reference/accounts_auth.html>, <https://github.com/eXhumer/f1-live-timing>, <https://github.com/Slowlydev/f1-dash>, <https://www.formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt>.

### 2.3 FastF1
- Best-in-class historical loader (laps with `Compound`, `TyreLife`, `Stint`, `PitInTime` / `PitOutTime`, `TrackStatus`, `IsAccurate`), but it reads the official static archive.
- Since October 2026: requires F1 TV login (FastF1 ≥ 3.9 supports credentials). Browser add-on flow per official docs. Not supported in hosted notebooks. Cloud servers reportedly blocked even with a token (Fast-F1#988).
- Consequence: FastF1 cannot run in CI or on the demo server. It is at most an optional, local-only adapter.

### 2.4 Jolpica
- Ergast-compatible schema (`/ergast/f1/{season}/{round}/results|laps|pitstops|…`). Paginated with `limit` / `offset`, max 100 rows.
- Canonical for calendar, results and Jolpica `pitstops` (lap, stop number, duration). Updated after sessions, not live.
- Rate limits: 4 req/s burst, 500 req/hour sustained. These figures come from a third-party crate and must be checked against jolpica-f1 `docs/rate_limits.md`.

### 2.5 Non-API sources
- **FIA timing PDFs** (Pit Stop Summary, Lap Analysis, History Chart): official and authoritative, with filenames following `YYYY_RR_ccc_f1_r0_timing_<type>_v01.pdf`. Parsing is brittle (layout drift, multi-page tables). Best use is as an independent check of pit-stop durations during backtest validation, not as a primary feed.
- **Broadcast OCR / video analysis**: technically possible (timing tower OCR), legally excluded (FOM broadcast rights). **Not used.**
- **Team radio audio + speech-to-text**: OpenF1 `team_radio` exposes clip URLs. Transcribing them (e.g. Whisper) could detect "box box" calls, but the audio is FOM content. Out of scope. Possibly an opt-in local experiment later.
- **Weather**: OpenF1 `weather` gives on-track samples (air/track temperature, rainfall, wind). Open-Meteo adds a forecast (rain probability for the next hour), which is relevant to strategy and free under CC-BY 4.0.
- **Community datasets**: TracingInsights (Apache-2.0 per its docs) re-publishes lap and telemetry JSON. Its provenance relies on FastF1 / MultiViewer, so the same upstream terms apply.
- **MultiViewer** (desktop app, F1 TV based) and its undocumented circuits API: not a data source for us (used by v1, dropped).
- **Game telemetry (EA F1 UDP)**: real-time and well documented, but it describes the video game, not real races. Out of scope.

## 3. Consequences for StintLine

> **Superseded by [ADR 0002](../adr/0002-data-sources-and-live-strategy.md).** FastF1 is dropped entirely, and live mode uses our own unauthenticated SignalR Core client, run locally.
> A probe on 2026-11-03 confirmed that 20 topics, including `TimingAppData`, `TyreStintSeries` and `LapSeries`, are delivered without auth. Only `CarData.z` and `Position.z` are withheld.
> The list below is the initial proposal, kept for history.

1. **OpenF1 is the primary source** for laps, stints, pit, race control, weather and intervals, historical and free. **Jolpica** is canonical for calendar, results and pit-stop durations.
2. **FastF1 becomes an optional, local-only adapter** behind the provider interface. It is disabled in CI and on the demo server, and it requires the user's own F1 TV credentials via environment variables. Tests use recorded fixtures only, as for every provider.
3. **Live mode requires the user's own OpenF1 Sponsor token** (`OPENF1_CLIENT_ID` / `OPENF1_CLIENT_SECRET`). The worker uses MQTT when available and falls back to REST polling within the 6 req/s and 60 req/min budget.
4. **The public demo never serves live data.** It runs replay mode from data stored in the database (seeded fixtures), which respects the personal-use terms of OpenF1 Sponsor and formula1.com.
5. **Fixtures**: keep recorded fixtures small (3 reference races, only the endpoints needed) and document their origin in `docs/data-sources.md`.
6. **FIA PDFs** are an optional validation source for pit-loss backtesting (Phase 4), not ingested in production.
