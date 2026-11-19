# 0021. Lap altitude and a 3D replay of the fastest laps

- Status: Accepted (maintainer validated Phase 18 on 2026-11-19)
- Date: 2026-11-19

## Context
The telemetry tab (ADR 0013) compares fastest laps on distance charts and a flat circuit
drawing. Fans also want to *see* two laps side by side: where one car pulls away, how a
circuit climbs and drops (Interlagos, Spa, the Red Bull Ring). OpenF1 `location` already
returns `z` with `x` and `y`, in the same units (decimetres: 348 units of climb at the
Hungaroring for ~35 m), but we dropped it at the provider boundary.

## Decision drivers
- No extra upstream request for new races; a bounded catch-up for stored ones.
- The strategy engine stays pure; the web keeps one chart library (visx, ADR 0003) for 2D.
- The 3D view is optional: it must never slow down or break the page for a browser without
  WebGL, a phone, or a test runner.
- Original drawings only (no team liveries, no official car models).

## Options considered
### Altitude: store `z` with the stored positions (chosen)
- Pros: same request, no schema change (`TelemetryLap.positions` is JSON), one key added.
- Cons: laps stored before need their positions fetched again (one request per lap).

### Altitude: elevation from a terrain service by GPS
- Cons: we have no GPS coordinates per sample, another provider, worse precision than the feed.

### 3D: `three` + `@react-three/fiber` (chosen)
- Pros: MIT, the reference WebGL library, declarative scene in React 19, tree-shaken and
  loaded only when the 3D view opens.
- Cons: ~250 kB gzipped for the 3D chunk; no WebGL in jsdom.

### 3D: Babylon.js, or a hand-written WebGL / canvas projection
- Cons: Babylon is larger and less common in React; hand-written WebGL is a lot of code to
  own for cameras and lighting.

### Helpers: `@react-three/drei`
- Not added: we need a camera rig, text labels and a ribbon, all a few lines with `three`.

## Decision
- `racedata`: `PositionSample.z` (optional). `stintline.ingestion.telemetry` stores
  `positions.z` only when every sample has it, so a lap is either complete or flat.
  `missing_altitude()` lists races with flat laps; `add_altitude()` fetches the positions
  again (car data is kept). `refresh_recent` queues 4 such races per run
  (`ALTITUDE_BACKFILL_PER_RUN`, ~80 requests); `manage.py ingest_telemetry --altitude
  [--session ID | --season YEAR] [--sync]` does it on demand.
- Engine (`stintline_strategy.telemetry`): `Trace.z`, `plane_scale` (metres per plane unit:
  the lap length over its drawn path, so the feed's units are never assumed),
  `elevation` (metres above the lap's lowest point) and `time_gap_to_distance` (metres a car
  is behind the first one when it passes each point).
- API: `GET /sessions/{id}/telemetry/compare` adds `metres_per_unit` and, per car, `t_s`
  (time at each point), `gap_m` and `elevation_m` (null for flat laps).
- Web: a relief strip under the distance charts and the gap in metres in the readout. A
  "3D lap" view (`?lap=3d`) next to the map: `webgl.ts` checks WebGL before the 3D chunk is
  even requested, else the map is shown with a note. `Lap3DScene` (the only module that
  imports `three`, `React.lazy`) draws the reference line as a ribbon with white edges and
  embankments down to the ground, relief exaggerated ×2 (`ELEVATION_EXAGGERATION`), an
  original low-poly single-seater per driver in its team colour (a stripe on the team-mate),
  and three cameras: chase, above (frames the whole circuit, driver labels) and trackside
  (posts every 180 m with a long lens). `ReplayClock` runs every car at its own lap time;
  play, pause, ×0.25 to ×4, a lap-time slider. The replay moves the 2D charts' pointer
  (8 times a second), pointing the charts while paused moves the cars, and a zoomed part of
  the lap (`?zoom=`) plays in a loop.

## Consequences
- Positive: a lap you can watch, with the real climb of the circuit; altitude and on-track
  gaps also enrich the 2D charts.
- Negative / risks: ~2,300 requests to give altitude to every stored race (about 80 minutes of
  the OpenF1 free budget, spread over `refresh_recent` runs or queued at once). The 3D scene
  is excluded from unit-test coverage (no WebGL in jsdom); its maths live in `track3d.ts` and
  `playback.ts`, tested, and it is checked in Chromium with software WebGL. Embankments can
  fold over themselves in the tightest hairpins (thin dark slivers).
- Follow-ups: driver-to-driver camera cut, kerbs from braking zones, an e2e journey through
  the 3D view once Playwright runs with SwiftShader in CI.
