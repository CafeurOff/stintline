# Phases 13–19: "Pit wall" redesign and paddock features

Status: validated on 2026-11-12 with the recommended option for every decision in section 7
(A: relay the PDF, B: incidents without money figures, C: rail + context bar, D: stop after the
pilot, E: changed on 2026-11-12, headline pictures as URL references (ADR 0015), F: no transcripts for now), except the design itself: it is first
tried on one page (the home page, on a branch) and adopted only if the maintainer likes it.
Each phase still gets its own short go/no-go before it starts.

## 1. Why

The maintainer reviewed the site after Phase 12 and called the design "AI slop". A competitor,
F1 Cosmos (f1cosmos.com), also offers features we lack: official FIA documents with a viewer,
car upgrades from the FIA presentation documents, power unit usage, crash analysis, weather
forecasts, a richer live timing tower, lap-time consistency charts, a news reader and a 3D
lap replay. Goal: offer all of this our own way, with a design that looks hand-made and still
feels like motorsport. **We do not copy their look**: no navy-blue ground, no blue bar
charts on every page, no logos, no pie charts.

## 2. Diagnosis of the current look

What makes Phase 12 read as generated, from the current screenshots and the anti-slop
literature (sources at the end):

| Tell | Where we have it |
| --- | --- |
| Every block is a rounded card (12–16 px radius) with a coloured top border and a tinted fill | home hero, standings, Grand Prix cards, news |
| Grid of identical cards | Grands Prix, drivers, teams |
| Tiny uppercase tracked labels everywhere | `ROUND 17 ·`, `WINNER`, `NEXT GRAND PRIX ·` |
| Countdown tiles and pills | home, calendar, header |
| Hero with a giant title, a subtitle and two buttons | home |
| Decoration with no data | red slash on every title, stripe texture, circuit watermark on every card |
| Default "racing" font | Titillium Web 900 italic |
| Flat colour blocks standing in for missing photos | home podium |

The literature agrees on the cause: these are defaults. Banning a few classes is not enough.
The fix is one explicit direction, written down before any code, then enforced.

## 3. Design direction: "pit wall"

Reference material comes from the sport, not from SaaS dashboards: printed FIA timing and
classification sheets, the engineers' timing screens on the pit wall, onboard and timing-tower
graphics, the pit-board. The racing feel comes from **timing semantics and track geometry**,
not from decoration.

### 3.1 Principles
1. **Data is the ornament.** Every visual element encodes something: a lap, a sector, a
   compound, a gap, a flag. Nothing is drawn only to fill space.
2. **Rules, not cards.** Panels are separated by 1 px hairlines and column alignment, as on a
   timing sheet. Cards only for real objects you can pick (a Grand Prix, a driver), and even
   then without shadows, tints or top borders.
3. **Timing colours as the colour system.** Purple = fastest overall, green = personal best,
   yellow = slower / yellow flag, red = live / red flag / retirement, blue = blue flag /
   information. Team colours identify cars and nothing else. One accent (signal red) for live
   state and primary actions.
4. **Two typefaces with jobs.** Archivo (variable, width axis 62–125) for text and headings,
   condensed widths for headings and tower names; IBM Plex Mono for every number (times, gaps,
   points, laps). Both OFL, self-hosted with fontsource. Titillium goes.
5. **Hard geometry.** Radius 0–2 px. One signature shape: a 45° chamfered corner (the
   pit-board / number-plate cut), used only on position boxes, compound marks and the active
   tab. Kerb stripes (red/white) appear only where they mean something: track limits on the
   circuit and the "live" marker.
6. **Density with hierarchy.** 4 px grid, 13–14 px body, tables first. Big type is reserved
   for one number per view (the winner's time, the gap, the countdown).
7. **Motion means time.** Animation only for things that move in reality (cars, clock,
   playback). No entrance animations, no hover lifts. `prefers-reduced-motion` respected.

### 3.2 Tokens (first draft, tuned on the specimen page)
- Ground: graphite `#101113` (dark), off-white `#f4f3ef` (light). Panels differ by one step
  only (`#16171a`), lines `#2a2c31`.
- Ink `#ececee`, muted `#9a9ca3` (≥ 6:1). Signal red `#e10600`-ish for action fills, a lighter
  red for text. Timing purple `#a259ff`, green `#2bd56b`, yellow `#ffd21f`, blue `#3b9cff`
  (each checked for AA on both grounds, with a text alternative).
- Compounds unchanged (letter + colour).
- Type scale: 12 / 13 / 14 / 16 / 20 / 28 / 44 / 72, mono numbers with `tabular-nums` and
  slashed zero.

### 3.3 App frame
- **Left rail** grouped by intent: *Weekend* (Live, Calendar), *Race* (Results, Analysis,
  Telemetry, Strategy replay), *Championship* (Drivers, Constructors, Profiles), *Technical*
  (Upgrades, Power units, Incidents), *Paddock* (News, FIA documents), *How it works*.
  Collapsible to icons, a bottom bar with a drawer on phones.
- **Context bar** at the top of every race page: season · Grand Prix · session · drivers,
  kept in the URL and shared across Analysis, Telemetry and the circuit, so switching pages
  keeps the selection. Right side: next session countdown, track weather, theme, FR/EN.
- Breadcrumb-free page titles: one line, condensed, with the context as a subtitle.

### 3.4 Guard rails
- `docs/design.md`: tokens, type scale, components, the banned list below, with good and bad
  examples.
- Banned (ESLint `no-restricted-syntax` on `className` strings, fails CI): `rounded-lg` and
  above, `shadow-*`, `bg-gradient-*`, `backdrop-blur*`, `ring-*` glows, `animate-bounce|pulse`
  outside the live marker, arbitrary hex colours.
- `/dev/specimen` page (development build only): every primitive in both themes and FR/EN.
- Playwright visual snapshots of each page at 1600 px and 390 px, reviewed at the end of
  every phase, as a fan would.
- Charts follow the dataviz rules: no pies (part-to-whole → stacked bar or waffle), direct
  labels over legends, one highlighted series, text alternative for each chart.

## 4. Feature gap and how we answer it

| F1 Cosmos | Their way | Our way |
| --- | --- | --- |
| Live timing tower (Lap / Sector / Tyre / Grid tabs, mini-sectors) | Blue table | Pit-wall tower: mini-sectors as purple/green/yellow segments, tyre age, pit count, gap/interval toggle, chamfered position boxes, compact and full modes |
| Session progress | Blue bar | Lap timeline with flag periods (SC, VSC, red, yellow) drawn as kerb-coloured spans, pit stops ticked per driver |
| Gap "orbit" | Circular gap to leader | Same idea redone: a lap-length ring where cars sit at their time gap, laps down stacked outside, the selected driver's undercut window shaded (uses our pit-exit model, which they lack) |
| Race control, pit stops, team radio | Panels | Feed with lap tags and flag icons, pit lane and stationary times with the field average, radio with play and (optional) transcript |
| Weather | Header strip + forecasts | Live strip from the feed, forecast per session from Open-Meteo on the calendar, the weekend page and the home page, with rain probability during the session window |
| FIA documents | Card grid + viewer | Per-weekend document list grouped by type (decisions, classifications, technical, timetable), search in the text, viewer, and **links into our data**: a stewards' decision appears on the driver, the Grand Prix and the lap where it happened |
| Car upgrades | Team × round heatmap + drawer | Team × round matrix (count encoded in cell fill, team order by total), drawer with each part, reason, purpose and description, parts placed on a top-down outline of the car, and a "did it work?" line: the team's race pace relative to the field before/after (our data) |
| Power units | Used/remaining matrix | Element usage per driver against the season allowance (named parameter per regulation year), penalties marked, projection of who will exceed |
| Crash analysis | Estimated crash costs | See decision B: incidents and penalties from stewards' decisions and race control (real facts), optional estimated cost only if a sourced price list exists |
| Constructors standings | Bump chart, pie, stat bars | Bump chart with direct labels, points share as a stacked bar per round, wins / podiums / point finishes / retirements as a small-multiples table |
| Lap time records | Candlesticks | Box plots per driver (median, spread, outliers), filters: exclude pit laps, SC laps, cut-off %; fuel-corrected option (our model) |
| Results consistency | Scatter | Grid vs finish slope chart and positions gained |
| Telemetry 3D replay | Three.js track, chase camera, speeds | Our 3D lap: track ribbon with real elevation (OpenF1 `z`), kerbs at corners, original low-poly car in team colour, chase / top / trackside cameras, two drivers synchronised, gap in metres and seconds, playback 0.5×–10×, scrub bar shared with the 2D charts and the zoom (ADR 0013 zoom) |
| News | List + reader pane with thumbnails | List grouped by story (same race or driver within 12 h), source filter, reader pane with headline, source, time, link out, **plus our context**: the drivers and Grand Prix it mentions, with their latest results and our race report. Thumbnails: decision E |
| Replay, custom layout, delay | — | Already have replay and delay. Custom layout: out of scope for now |

What we keep that they lack: what-if strategy replay, pit-stop and undercut simulation on the
circuit, fuel-corrected degradation with backtests, written race reports, history since 1950.

## 5. Phases

Each phase: short plan, validation, small Conventional Commits, `make check` green, visual
review at 1600 px and 390 px, CLAUDE.md, docs and ADRs updated.

### Phase 13 — Design system and frame (validation gate)
- ADR 0015 "Pit wall design" replacing the visual rules of ADR 0014 (keeps official media and
  public-copy rules).
- Fonts (Archivo, IBM Plex Mono), tokens in `index.css`, light and dark.
- Primitives rebuilt: `Panel` (hairline section), `DataTable`, `Stat` (one number + label),
  `Tag` (chamfered), `PositionBox`, `TimingCell` (purple/green/yellow), `SegmentedControl`,
  `Tabs`, `Drawer`, `ContextBar`, `Rail`.
- New app frame (rail, context bar, phone bottom bar), router groups.
- `docs/design.md`, `/dev/specimen`, ESLint guard, Playwright snapshot harness.
- **Pilot pages: home and one Grand Prix page.** Stop for review before going further.

### Phase 14 — Re-skin every existing page
- Calendar (list by month, not a card grid; circuit outline only on the selected race),
  Grand Prix page, analysis tabs, drivers, teams, profiles, standings, circuit and strategy
  replay, tyres, live, news, report, model page.
- Standings: bump chart, share per round, stats table (replaces any pie-like view).
- Results: grid vs finish slope chart.
- Remove `CircuitMark` watermarks, stripe texture, slash titles; delete dead CSS.

### Phase 15 — Paddock: FIA documents and news reader
- `racedata.providers.fia`: weekend document lists from fia.com HTML (championship →
  season → event pages), PDF download through the HTTP client (rate limit 1 request / 10 s
  as asked by fia.com `robots.txt`, cache, retry). Text extraction with `pypdf`.
- Model `FiaDocument` (event, number, title, category, published_at UTC, url, page count,
  text, cars mentioned → session entries). Categories from the title (decision, summons,
  infringement, classification, technical, timetable, other).
- Stewards' decisions parsed into `StewardsDecision` (car, driver, session, lap if stated,
  offence, penalty: time, grid, points, reprimand, fine, no further action).
- Ingestion task in `refresh_recent` (current weekend every 30 min during a weekend, else
  daily) and `manage.py ingest_fia_documents --season 2026`.
- API: `GET /fia-documents?season=&event=&category=&q=`, `GET /fia-documents/{id}`,
  `GET /fia-documents/{id}/pdf` (decision A).
- Web: `/documents` (weekend list, filters, search, shareable `/documents/:id`), viewer with
  `pdfjs-dist` (lazy chunk), decisions shown on the Grand Prix page, driver profile and the
  lap chart.
- News reader: story grouping, source filter, reader pane with our context; thumbnails per
  decision E (ADR 0012 amendment if accepted).
- Fixtures: recorded HTML pages and two or three small PDFs (trimmed), no network in tests.

### Phase 16 — Technical
- Car upgrades: parse the "Car Presentation Submissions" PDF of each weekend with
  `pdfplumber` (one table per team: updated component, primary reason "Performance - Flow
  Conditioning" split into reason and purpose, geometric differences, description).
  Normalise wording (case, synonyms) with a mapping table in code. Model `CarUpgrade`.
  2025 and 2026 seasons.
- Upgrades page: team × round matrix, drawer with parts on a top-down car outline (original
  SVG, parts placed by a named mapping), before/after race pace line.
- Power units: parse the per-weekend "Power Unit Elements Used" document, model
  `PowerUnitUsage` (driver, event, element, count), allowances per regulation year as named
  parameters (2026: ICE, TC, EXH, MGU-K, ES, CE, ANC…; 2025: with MGU-H), page with used /
  remaining toggle and grid penalties linked from stewards' decisions.
- Incidents (decision B): per driver and team, collisions, track limits, unsafe releases,
  penalties and points on the licence per season, round-by-round chart, most serious
  incidents with the document and the lap.

### Phase 17 — Weekend and live
- `racedata.providers.openmeteo` (free, no key): hourly forecast for the circuit location,
  stored as `WeatherForecast` per session window, refreshed every 3 h from D-10.
- Calendar and weekend page show forecast per session (temperature, rain probability, wind).
- Live: rebuilt tower (Lap / Sectors / Tyres / Grid views, mini-sectors from TimingData
  segments), session lap timeline with flags, gap ring with undercut window, race control
  with lap tags, pit lane and stop times with averages, weather strip. Replay and demo
  recordings updated, so the public demo shows all of it.
- Team radio transcripts: only if decision F says yes (local `faster-whisper`, run by the
  live process on the maintainer's machine, text stored, audio never re-hosted).

### Phase 18 — Analysis and 3D lap
- Lap time records: box plots per driver with filters (pit laps, SC/VSC laps, cut-off %,
  fuel-corrected), sortable by median.
- Telemetry: store `z` in `TelemetryLap.positions` (migration plus a bounded backfill
  command re-fetching `location` for stored laps only), compute a track ribbon (centre line,
  width, banking-free) in `stintline_strategy.telemetry` or a new pure module.
- 3D mode with `three` + `@react-three/fiber` (MIT, lazy chunk, WebGL check with a 2D
  fallback): track ribbon with elevation, kerbs where curvature is high, start line and
  sector boundaries, original low-poly car in team colour (built in code, no third-party
  model), chase / top / trackside cameras, two cars synchronised by lap fraction, gap in
  metres and seconds, playback speeds, shared scrub and zoom with the 2D charts, keyboard
  controls, reduced-motion = no camera moves.
- ADR 0016 for the 3D stack and stored elevation.

### Phase 19 — Polish
- Full visual review on real data (2026 complete), performance budget (initial JS, lazy
  chunks for pdf.js and three), accessibility pass (axe in Playwright), README and
  screenshots, demo stack updated, CLAUDE.md status.

## 6. New dependencies (all free, open licences)

| Package | Licence | Why |
| --- | --- | --- |
| `pypdf` | BSD | FIA document text |
| `pdfplumber` | MIT | Upgrade and power unit tables |
| `pdfjs-dist` | Apache-2.0 | In-page document viewer |
| `three`, `@react-three/fiber` | MIT | 3D lap |
| `@fontsource-variable/archivo`, `@fontsource/ibm-plex-mono` | OFL | Type |

## 7. Decisions (recommended options accepted)

- **A. FIA PDF preview.** (a) our API relays the PDF from fia.com without storing it and pdf.js
  renders it, link to the original always shown (recommended); (b) link out only, our text and
  extracted facts on the page. The PDFs carry the FIA and F1 logos: shown only inside the
  original document, never reused elsewhere.
- **B. Crash analysis.** (a) incidents and penalties from official decisions, no money
  figures (recommended, matches "no magic numbers"); (b) also an estimated cost, only with a
  documented, sourced price list per component.
- **C. Frame.** Left rail + context bar (recommended) or keep a top bar.
- **D. Pace.** Stop after Phase 13 pilot pages for review (recommended), or chain 13–19.
- **E. News thumbnails.** (a) keep ADR 0012: headline and link only, the reader pane shows our
  context (recommended); (b) show the feed-provided thumbnail as a URL reference, never
  downloaded, behind a switch like official media (amends ADR 0012).
- **F. Team radio transcripts.** Local speech-to-text during live mode (free, CPU cost on the
  maintainer's machine) or no transcripts.

## 8. Risks
- fia.com HTML or PDF layouts change: parsers fail loudly per document, keep the document
  with an "unparsed" flag, tests on recorded fixtures for each layout seen (2025, 2026).
- PDF fixtures are large (up to 3 MB): record trimmed copies (needed pages only).
- 3D cost on phones: lazy chunk, capped pixel ratio, 2D fallback.
- Scope: seven phases. The gate after Phase 13 limits the cost of a wrong design direction.

## Sources
- F1 Cosmos pages and changelog (formulaone.featurebase.app/changelog), screenshots from the
  maintainer, 2026-11-12.
- FIA document index and "Car Presentation Submissions" PDFs on fia.com; fia.com robots.txt
  (crawl delay 10 s).
- Anti-slop: 925studios.co "AI slop web design guide", noqta.tn "AI design slop overused UI
  patterns", superdesign.dev "how to make AI UI look less generic", claudecodehq "unslop UI",
  prg.sh "Why your AI keeps building the same purple gradient website", UX Planet "I tried to
  make Claude Code stop producing AI slop".
