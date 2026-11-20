# 0026. Race replay stage, timing tower and a 3D view of the race

- Status: Accepted (maintainer validated the redesign on 2026-11-20)
- Date: 2026-11-20

## Context
The replay and strategy page (`/sessions/:id`, ADR 0007) was the last page still drawn in the
first design: a grey outline on black with coloured dots, a grid of 21 portraits to pick a
driver, and a bare lap slider. The rest of the site moved to the night-race glass design
(ADR 0023). The page also hid what a timing screen shows first, the running order with gaps
and tyres, and asked for a more spectacular way to watch the race, such as 3D or satellite.

## Decision drivers
- No new data source, no API change, no paid service (zero budget, ADR 0002).
- Keep the page's contract: shareable URL state (`?car=&lap=&mode=&plan=`), cars reachable
  with the keyboard, the simulators unchanged.
- 3D must stay optional and never slow down or break the page (phones, no WebGL, tests).

## Options considered
### Satellite imagery under the circuit
- Pros: the most recognisable view of a circuit.
- Cons: the outline would need georeferencing, which a GeoJSON set of circuits (MIT) could
  give. But free high-resolution imagery comes under Esri's Master License Agreement,
  whose terms for keyless public use are unclear. Not taken for now.

### 3D on the relief of the fastest lap (chosen)
- Pros: the track, its altitude and the original single-seater already exist (ADR 0021);
  one telemetry request gives the geometry.
- Cons: only for races with stored telemetry; three.js is loaded for one more view.

### Restyling the 2D map only
- Cons: it does not answer the request for a more immersive view.

## Decision
- **Stage.** The map sits in a glass card lit in the circuit colour (`circuitAccent`), with
  the track status at the replay lap (green, safety car, VSC, red flag from
  `SessionDetail.neutralisations`) and a Map / 3D switch (`?view=3d`). The 2D map has dark
  tarmac, the racing line lit in the circuit colour, a dashed start line and a breathing
  halo on the followed car. Car labels and the halo do not catch clicks.
- **Timing tower** (`RaceTower`, maths in `tower.ts`): the running order at the replay
  instant with the gap to the leader or to the car ahead (the time since that car passed
  the same point), laps down, tyre and age, and stops. A line selects the driver, which
  replaces the portrait grid.
- **Replay bar**: the lap strip marks neutralised laps and the followed driver's in-laps,
  with a text summary for screen readers; the native slider stays the control.
- **3D view** (`Race3DView`, scene in `Race3DScene`, lazy): the track comes from
  `GET /sessions/{id}/telemetry/compare` for the fastest lap. A car that has run a share of
  its lap stands where the reference lap was after the same share of its time
  (`race3d.ts`), as on the 2D map. Cars on the same spot are eased side by side. The
  followed car has a ring, the simulated stop a ghost ring, and a click on a car follows
  it. There are three cameras: overview (driver labels), chase and trackside. Without
  WebGL or telemetry, a message points back to the map.
- The circuit scene and the camera rig are shared with the lap view: `CircuitWorld`,
  `cameraRig.ts`. This amends ADR 0021: `three` is now imported by the modules of the two
  3D scenes, all loaded on demand.

## Consequences
- Positive: the page reads like a timing screen and matches the rest of the site. The race
  can be watched in 3D with no new data or dependency.
- Negative / risks: on a phone the tower and the panel follow the stage, so the page is
  long. Races without telemetry have no 3D view. The 3D scene is excluded from unit-test
  coverage (no WebGL in jsdom); its placement maths (`race3d.ts`) and cameras
  (`cameraRig.ts`) are tested, and the scene is checked in Chromium with software WebGL.
- Follow-ups: satellite imagery if a free licence fits, a driver-to-driver camera cut,
  pit-lane geometry so stopping cars leave the track.
