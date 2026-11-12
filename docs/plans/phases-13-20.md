# Phases 13–20: dashboard design, paddock, technical and analysis pages

Status: Phase 13 done (2026-11-12). Phase 16 done (2026-11-13, ADR 0017). Later phases validated as a direction on 2026-11-12; each
still gets a short go/no-go before it starts. Decisions taken on 2026-11-12: FIA PDFs relayed by
our API and shown in the page (A), incidents and penalties from official decisions, no money
figures (B), sidebar navigation (C), headline pictures as URL references (E, ADR 0015), no
radio transcripts for now (F).

## How we got here
The maintainer rejected the Phase 12 broadcast look ("AI slop"), then a minimal "pit wall"
pilot and three mock-ups as empty. The reference genre is the F1 data dashboard
(formula1dashboard.com, F1DASH, F1 Cosmos): icon sidebar, tiles of real figures, dense tables
with movement arrows, tagged fact cards, flags, photos everywhere. We take the genre, not
anyone's look or features verbatim, and we lead with what only we have: the strategy engine
(fuel-corrected pace, degradation, pit loss, undercut and what-if replays) and written race
reports.

## Phase 13 — Dashboard design (done)
ADR 0016, `docs/design.md`. Icon sidebar, filter pills, `Panel`, `Tile`, `Face`, `Move`,
`RoundBars`, flags (flag-icons), icons (lucide). Pages: dashboard home, Grand Prix cards and
Grand Prix page (race tiles, facts), driver profile as a season dashboard, standings (moves,
points share), news wire with a reader and the drivers and teams a headline names, harmonised
teams, live, model, circuit pages. Headline pictures (ADR 0015).

## Phase 14 — Paddock: FIA documents and stewards' decisions
- `racedata.providers.fia`: weekend document lists from fia.com (1 request / 10 s, robots.txt),
  PDF text with `pypdf`. Model `FiaDocument` (event, number, title, category, published_at,
  url, text, cars named). Categories from the title.
- `StewardsDecision` parsed from decision documents: car, driver, session, lap, offence,
  penalty (time, grid, points, reprimand, fine, no further action).
- API with search and a PDF relay (no storage). Page `/documents`: weekend list as cards with
  category tags, filters, full-text search, viewer (`pdfjs-dist`, lazy), shareable URL.
- Decisions shown on the Grand Prix page (facts), the driver profile and the lap chart.

## Phase 15 — Technical
- **Upgrades**: "Car Presentation Submissions" PDFs parsed with `pdfplumber` (component,
  reason, purpose, geometry, description). Team × round heatmap; drawer with the parts on a
  top-down car outline (original SVG) and our addition: race pace relative to the field
  before and after the package (fuel-corrected, from our engine).
- **Power units**: per-weekend element usage, allowance per regulation year (named
  parameters), used / remaining matrix, projected grid penalties.
- **Incidents and penalties** (our answer to crash-cost tables): collisions, track limits,
  unsafe releases, penalty points on the licence per driver, round-by-round chart, the
  decision document and the lap of each incident. Real facts only.

## Phase 16 — Analysis hub (done, ADR 0017)
Built in this order after the plan was validated on 2026-11-13: per-race figures stored by
`stintline.analysis`, then the pages. Head-to-heads cover every season since 1950 (grid stands
in for qualifying before 1994); the pace gap needs timing (2023+). Race pace is its own page and
the Grand Prix pace tab links to it. Pit losses that do not stand for the circuit (wet, too few
stops, unrecorded red flag) stay in the tables, greyed, and are left out of medians.

Original scope:
- **Head-to-head**: pick two drivers or a team. Qualifying and race head-to-head as split bars
  for every team, teammate qualifying gaps as a dot strip per session, points, finishes,
  laps led. Our addition: pace gap on clean laps, fuel-corrected, race by race.
- **Race pace**: box plots per driver (median, spread, outliers), pace evolution chart,
  lap-time scatter, positions chart, fastest laps table. Filters: pit laps, SC/VSC laps,
  cut-off %, and a fuel-corrected switch (our model) that others do not have.
- **Consistency**: spread of clean laps per driver across the season, best and worst races.
- **Pit stops**: fastest stationary and lane times per team and per race, team averages,
  our pit loss per circuit with its uncertainty, and how often an undercut worked there.
- **Track DNA**: one card per circuit from our own data: full-throttle share, braking zones,
  top speed, lap length, pit loss, tyre degradation level, safety-car rate since 2023,
  overtakes (position changes), winning strategies.

## Phase 17 — Weekend and live
- Open-Meteo forecasts per session (free, no key) on the calendar, the home page and the
  Grand Prix page; rain probability over the session window.
- Live tower with mini-sectors (purple / green / yellow), tyre age, pit count; session
  timeline with flag periods; gap ring with the undercut window from our pit-exit model;
  race control with lap tags; pit lane and stop times with averages; weather strip.
  Recordings and the public demo replay all of it.

## Phase 18 — Telemetry and 3D lap
- Store `z` from OpenF1 `location` (migration and a bounded backfill), track ribbon with real
  elevation. 3D mode with `three` + `@react-three/fiber` (lazy, WebGL check, 2D fallback):
  original low-poly car in team colour, chase / top / trackside cameras, two drivers
  synchronised, gap in metres and seconds, playback speeds, shared scrub and zoom with the 2D
  charts. ADR for the 3D stack.

## Phase 19 — Ideas of our own (proposed, to validate one by one)
- **Title maths**: what each contender needs in the remaining rounds, when a title can be
  decided, eliminated drivers (exact arithmetic from the points system of the season).
- **Strategy preview** before a race: likely one- and two-stop windows for the circuit from our
  degradation and pit-loss models, adjusted to the forecast temperature.
- **Undercut atlas**: for each circuit, how much an undercut gained in past races (our backtest).
- **Driver form**: last five races as a compact strip (finish, gained places, pace gap to the
  teammate), on cards and profiles.
- **Season review** page written from our data at the end of each season (champion, records,
  best races, biggest climbs), reusing the report writer.
- **Eras comparison**: points rescaled to today's system to compare drivers across decades.

## Phase 20 — Polish
Full review on real data at 1600 px and 390 px, accessibility pass (axe in Playwright),
performance budget (lazy chunks for pdf.js and three), README and screenshots, demo stack.

## New dependencies (all free, open licences)
`lucide-react` (ISC), `flag-icons` (MIT), `@fontsource-variable/archivo` and
`@fontsource/ibm-plex-mono` (OFL) — added in Phase 13. Later: `pypdf` (BSD), `pdfplumber`
(MIT), `pdfjs-dist` (Apache-2.0), `three` and `@react-three/fiber` (MIT).
