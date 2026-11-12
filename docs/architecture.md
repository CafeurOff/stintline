# Architecture

StintLine ingests public timing data into its own database, runs a pure-Python strategy engine on it, and serves the results through a versioned REST API, a WebSocket channel and a React frontend.

## Overview

```mermaid
flowchart LR
    subgraph Sources["External sources"]
        OF[OpenF1 REST<br/>historical, free]
        JO[Jolpica<br/>calendar, results, pit stops]
        LT[Official live timing<br/>SignalR Core, no auth<br/>local only]
    end

    subgraph RD["packages/racedata (pure Python)"]
        HTTP[HTTP client<br/>rate limit · retry · cache · timeout]
        AD[Provider adapters<br/>openf1 · jolpica · livetiming]
        DTO[Typed DTOs]
        REC[Recorder<br/>raw .jsonl sessions]
    end

    subgraph API["apps/api (Django 5.2)"]
        ING[Celery ingestion<br/>ingest_season / event / session<br/>idempotent upserts]
        BEAT[Celery beat<br/>schedules]
        DB[(PostgreSQL)]
        SVC[Services and selectors]
        REST[DRF /api/v1<br/>OpenAPI · pagination · HTTP cache]
        LIVE[Live worker and replay engine]
        WS[Channels WebSocket]
    end

    STRAT[packages/strategy<br/>lap cleaning · fuel · degradation<br/>pit loss · undercut · pit exit · window]
    REDIS[(Redis<br/>broker · channel layer · cache)]
    TYPES[packages/api-types<br/>generated TS types]
    WEB[apps/web<br/>React 19 + TS<br/>TanStack Query]

    OF --> HTTP
    JO --> HTTP
    LT --> AD
    HTTP --> AD --> DTO
    AD --> REC
    DTO --> ING --> DB
    BEAT --> ING
    DTO --> LIVE
    REC -. replay files .-> LIVE
    LIVE --> DB
    LIVE --> REDIS --> WS
    DB --> SVC
    SVC --> STRAT
    STRAT --> SVC
    SVC --> REST
    REST -- OpenAPI schema --> TYPES --> WEB
    REST --> WEB
    WS --> WEB
    ING <--> REDIS
```

## Components

| Component | Responsibility | Must not |
| --- | --- | --- |
| `packages/racedata` | Talk to upstream sources, normalise payloads into typed DTOs (UTC datetimes, explicit units), record raw live sessions | Know about Django or the database |
| `apps/api` ingestion | Map DTOs to models with natural-key upserts. Schedule ingestion | Call upstream directly (always via `racedata`) |
| PostgreSQL | Source of truth for everything served | — |
| `packages/strategy` | Deterministic models and simulations on plain inputs | Do I/O, import Django or `racedata` |
| `apps/api` analysis | Run the engine once per imported race and store the figures the season and circuit pages read (`RaceStats`, `EntryRaceStats`, ADR 0017) | Run the engine over a whole season inside a request |
| `apps/api` REST | Expose data and strategy results under `/api/v1/`, documented with OpenAPI | Compute strategy logic inline in views |
| Live process (`manage.py live`) | Consume the live feed (or a recording), build a snapshot with the pit-now answer, keep the latest in Redis and broadcast it once per second (ADR 0011) | Write to Postgres, or run on the public demo server against the live feed |
| Channels | Push snapshots to subscribed browsers on `/ws/live`; the browser applies the TV delay | — |
| `apps/web` | Session picker, strategy timeline, degradation, simulator, model page, live/replay view | Call upstream APIs or redeclare API types |

## Runtime topology (docker compose)

`postgres`, `redis`, `api` (ASGI: Django + Channels), `worker` (Celery), `beat` (Celery beat), `web` (Vite dev server in dev, static build behind nginx in prod). One command: `make up`.

The public demo (`infra/docker-compose.demo.yml`, `make demo-up`) runs the production images of the same services plus a one-shot `migrate`, publishes only nginx, and never runs `live` (replay-only, ADR 0002). See [`deploy.md`](deploy.md).

## Key flows

1. **Historical ingestion.** `ingest_season(2025)` → `ingest_event` per round → `ingest_session` per session. This fetches OpenF1 laps, stints, pit, race control and weather, plus Jolpica results and pit stops, then upserts. Re-running is a no-op.
2. **Strategy query.** `GET /api/v1/sessions/{id}/undercut?attacker=…&defender=…&lap=…` → selector loads cleaned laps and stints → strategy engine fits degradation and pit loss → simulation → JSON with the expected gain and an uncertainty interval.
3. **Live (local).** `manage.py live` subscribes to the SignalR topics (TimingData, TimingAppData, TrackStatus, RaceControlMessages, WeatherData, LapCount, TeamRadio…), merges them and publishes a snapshot at most once per second to the cache and the `live` Channels group. `GET /api/v1/live` gives the state and latest snapshot; `/ws/live` streams the next ones. The browser applies the user's TV delay. Finished sessions are stored by the usual import, not by the live process.
4. **Replay (demo).** `manage.py live --replay FILE --speed N` plays a recorded `.jsonl` (or one rebuilt from a stored race by `manage.py live_demo`) through the same publisher, so the frontend cannot tell replay from live.
5. **News.** Celery beat reads the news feeds every 30 minutes through `racedata` and stores headlines (title and link). Race reports are built on request from stored results, timing and standings, and written in EN/FR by the web (ADR 0012).

See `docs/data-sources.md` for source limits and terms, and the ADRs for the reasoning behind these choices.
