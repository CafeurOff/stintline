# v1 audit

Audit of the v1 prototype ("F1 Checker", branded "F1 Grand Prix Explorer" in the UI) before the StintLine (v2) rewrite.

- Snapshot: commit `37550dd` on `main`, 28 commits, 74 tracked files (~6.9k lines: ~640 Python, ~5.9k JSX).
- Backups: `f1_checker_v1.bundle` (full history) and `f1_checker_v1_backup.tar.gz` (working tree + `.git`), stored next to the repository.
- Scope: `backend/api/*.py`, `backend/requirements.txt`, `frontend/src/**`, build config.

v1 is a reference for endpoints and screen ideas only. No v1 file is carried over into v2.

## 1. Stack

| Side | Stack |
| --- | --- |
| Backend | Django 5.1.6, DRF 3.15, `requests`, SQLite, function-based views in a single `views.py` |
| Frontend | React 19, Vite 6, Tailwind 4, React Router 7, Recharts 2, framer-motion, axios, lucide-react. Plain JSX, no TypeScript |
| Unused deps | `fastf1`, `pandas`, `numpy`, `scipy`, `matplotlib`, `requests-cache`, `RapidFuzz`, `websockets` are pinned in `requirements.txt` but never imported |

## 2. External endpoints used

### 2.1 Jolpica (Ergast-compatible), base `https://api.jolpi.ca/ergast/f1`

| Endpoint | Params | Fields actually read | v1 view |
| --- | --- | --- | --- |
| `/{year}/races/` (or `/current/races/`) | `year` | `round`, `raceName`, `date`, `time`, `Circuit.Location.country`, `Circuit.Location.locality`, `FirstPractice` / `SecondPractice` / `ThirdPractice` / `SprintQualifying` / `Sprint` / `Qualifying` → `date`, `time` | `get_season_races` |
| `/{year}/driverstandings/` | `year` | `StandingsTable.season`, `.round`, `DriverStandings[].position`, `positionText`, `points`, `wins`, `Driver.driverId`, `code`, `permanentNumber`, `givenName`, `familyName`, `nationality`, `Constructors[].constructorId`, `name`, `nationality` | `get_drivers_standing` |
| `/{year}/constructorstandings/` | `year` | `StandingsTable.season`, `.round`, `ConstructorStandings[].position`, `positionText`, `points`, `wins`, `Constructor.constructorId`, `name`, `nationality` | `get_constructors_standing` |

Pagination (`limit` / `offset`, default 30 rows) is never handled. This is harmless for these three endpoints but would truncate `laps` and `results`.

### 2.2 OpenF1, base `https://api.openf1.org/v1`

| Endpoint | Params | Fields actually read | v1 view |
| --- | --- | --- | --- |
| `/sessions` | `session_key=latest` / `session_key={k}` / `year={y}` | `session_key`, `date_start`, `date_end`, `session_type`, `circuit_key`, `circuit_short_name`, `location`, `country_name` (frontend also reads non-existent `circuit_name`) | `check_live_session`, `get_upcoming_sessions`, `get_session_details` |
| `/drivers` | `session_key`, optionally `driver_number` | `driver_number`, `name_acronym`, `full_name`, `team_name`, `team_colour`, `headshot_url` | `get_drivers_standing` (enrichment), `get_session_details`, `get_driver_telemetry` |
| `/position` | `session_key` | passed through raw, never read by the UI | `check_live_session` |
| `/laps` | `session_key` | passed through raw, never rendered | `check_live_session`, `get_session_details?laps=true` |
| `/team_radio` | `session_key` | passed through raw, never rendered | `check_live_session`, `get_session_details?radio=true` |
| `/race_control` | `session_key` | returned under `race_control`, but the UI reads `race_control_messages` and so never shows it | `get_session_details?race_control=true` |
| `/location` | `session_key`, `date>`, `date<` | `driver_number`, `date`, `x`, `y`, `z` (latest sample per driver) | `get_driver_positions` |
| `/pit` | `session_key` | `driver_number`, `pit_in`, `pit_out`. These fields do not exist in OpenF1 (`/pit` returns `lap_number`, `pit_duration`, `date`), so `inPit` is always `false` | `get_driver_positions` |
| `/car_data` | `session_key`, `driver_number` | passed through raw (unbounded: full-session telemetry at ~3.7 Hz) | `get_driver_telemetry` (no screen uses it) |

### 2.3 Other third-party sources

| Source | Usage | Note |
| --- | --- | --- |
| `https://api.multiviewer.app/api/v1/circuits/{circuitKey}/{year}` | Track outline, corners, sectors, rotation for the live map (`components/Circuits.jsx`) | Undocumented API of a third-party product, called directly from the browser. Not reused in v2 |
| `https://media.formula1.com/...` | Driver number logos, team car images, driver headshots (via OpenF1 `headshot_url`) | Official F1 assets, see §5 |

### 2.4 v1 internal API

| Route | View | Status |
| --- | --- | --- |
| `season/<int:year>/` | `get_season_races` | Works |
| `drivers_standing/<int:year>/` | `get_drivers_standing` | Works, slowly (1 + N sequential calls) |
| `constructors_standing/<int:year>/` | `get_constructors_standing` | Works |
| `api/live-session/` | `check_live_session` | Always returns `live: true` (hardcoded) |
| `api/upcoming-sessions/<int:days>/` | `get_upcoming_sessions` | Not used by the UI |
| `api/session-details/<int:session_key>/` | `get_session_details` | Works. Response keys do not match what the UI reads |
| `api/driver-positions/<str:session_key>/` | `get_driver_positions` | Works, pit flag broken |
| `api/driver-telemetry/<int>/<int>/` | `get_driver_telemetry` | Not used by the UI |
| `races/<year>/`, `get_race_result/<year>/<round>` | — | Called by the frontend but never implemented (404) |

## 3. Screens

| Route | Page | What it shows | State |
| --- | --- | --- | --- |
| `/` | `Home.jsx` | Season picker (2021–2025, hardcoded), live banner or countdown to next session, filter by format (conventional / sprint), grid of `RaceCard` (round, name, location, session times in user TZ) | Works. Live banner shows on every visit because of the `live: true` bug |
| `/f1/drivers` | `F1DriversStandings.jsx` | Driver standings cards: headshot, number logo, team logo, points, team colour | Works. Relies on official imagery |
| `/f1/constructors` | `F1ConstructorsStandings.jsx` + `F1Stats.jsx` | Constructor standings, team car images, then Recharts stats: points/wins bars, 5-season history, cumulative points per round | Partly broken: `F1Stats` calls missing `/races/{year}/`, so per-round charts are empty |
| `/f1/live/:sessionKey` | `F1LiveSession.jsx` | Header and countdown, tabs: circuit map with car dots (5 s polling), driver cards, race-control messages (always empty), stats (placeholder) | Partly working. Interval effect re-subscribes in a loop (`positionUpdateInterval` is in its own deps) |
| (unrouted) | `results/F1RaceResults.jsx` + `RaceResultsTab`, `PitStopsTab`, `DriverInfoTab` | Race results, pit-stop analytics (per lap, per driver, durations), "driver info" | Dead code: route missing, backend endpoint missing. `DriverInfoTab` generates random numbers (`Math.random()`) for braking, top speed, tyre wear and fuel, presented as real data |
| `*` | `404.jsx` | Not-found page | Works |

## 4. Reuse vs discard

### Reusable as ideas or knowledge (re-implemented from scratch in v2)

- **Source mapping.** The Jolpica and OpenF1 endpoints and fields above are the starting point for the v2 provider adapters.
- **Event format detection.** `Sprint` + `SprintQualifying` keys in Jolpica races → `sprint_qualifying` / `sprint` / `conventional`. Needed for `Event.format`.
- **Session type mapping** between Jolpica keys (`FirstPractice`, `Sprint`…) and OpenF1 `session_type` / `session_name`. Needed to join both sources.
- **Team colour from OpenF1 `team_colour`.** Team colours stay allowed in v2; logos do not.
- **Pit-stop analytics ideas** from `PitStopsTab` (stops per lap, per driver, duration distribution). These move to the strategy view, computed from stored `PitStop` rows.
- **Race-control flag palette** (`getFlagColor`) for SC/VSC/red-flag bands on the stint timeline. To be redone with AA-contrast tokens.
- **Session picker flow** (season → Grand Prix → session) from Home. This becomes the v2 entry screen.

### Discarded, and why

| Item | Reason |
| --- | --- |
| All v1 views | Synchronous proxy to third-party APIs, no persistence, no typing, untestable. v2 ingests into Postgres via Celery and serves from the DB |
| Standings pages | Out of scope: v2 is a strategy tool, not a results site |
| Live map (`Circuits.jsx`) | Depends on an undocumented third-party API. Live timing maps are what f1-dash and MultiViewer already do |
| `DriverInfoTab` | Fabricated random data. Must never ship |
| `F1Stats` | Depends on a missing endpoint. Season-history charts are out of scope |
| Team logos, car images, number logos, circuit pictures | Protected assets, see §5 |
| UI copy (French, hardcoded) | v2 UI is in English |
| `axiosConfig.js` | Hardcoded `http://127.0.0.1:8000`, cross-site credentials. v2 uses a typed client generated from OpenAPI |
| `RaceResult` migration | Model no longer exists in `models.py` (migration and model are out of sync) |

## 5. Protected graphic assets (not carried into v2)

| Path / source | Content | Count |
| --- | --- | --- |
| `frontend/src/images/teams/*.svg`, `*.png`, `*.avif` | Team logos (Alpine, Aston Martin, Ferrari, Haas, Kick Sauber, McLaren, Mercedes, Racing Bulls, Red Bull, Williams, Alfa Romeo) | 11 |
| `frontend/src/images/circuits/*.avif`, `*.png` | Circuit imagery (Abu Dhabi … USA) of unverified origin | 23 |
| `media.formula1.com/.../drivers/number-logos/{code}.png` | Official driver number artwork (hotlinked) | — |
| `media.formula1.com/.../teams/{year}/{team}.png` | Official team car pictures (hotlinked) | — |
| OpenF1 `headshot_url` (points to `media.formula1.com`) | Official driver headshots (hotlinked) | — |
| `F1` word mark in Navbar, Footer, `<title>F1 Explorer</title>`, red F1-style branding | Trademark usage in product name | — |
| Links to `formula1.com` | Navbar | — |

v2 policy: team colours only. No logos, car renders, headshots or official artwork. "F1" never appears in the product name, and the README carries a non-affiliation notice.

## 6. Problems found

### Performance and reliability
- **No caching.** `LocMemCache` is configured but never used, and `requests-cache` is installed but never imported. Every page view hits Jolpica and OpenF1 directly, including immutable historical seasons.
- **Sequential N+1 calls.** `get_drivers_standing` makes 1 Jolpica call plus one OpenF1 `/drivers` call per driver (~21 calls), in sequence. `check_live_session` chains up to 4 calls.
- **No timeouts.** `requests.get(url)` without `timeout`, so a hung upstream blocks a worker indefinitely.
- **No retry or back-off, no rate limiting.** OpenF1's free tier rate limit is not respected (the live page polls every 5 s per open tab).
- **Unbounded payloads.** `/position`, `/laps`, `/team_radio`, `/car_data` for a whole session are fetched and forwarded raw (megabytes) and mostly discarded by the UI.
- **Polling instead of push.** The frontend polls `/api/live-session/` every 30 s and positions every 5 s. The live page's effect re-creates intervals in a loop.

### Correctness
- `check_live_session` always returns `"live": True`.
- `year` is typed `<int:year>` in `urls.py`, so the `"current"` branches are dead code. The race filter condition in `get_season_races` is always true.
- `date_local` and `date_utc` are identical strings. Missing session times default silently to `00:00:00Z`. `datetime.now()` is naive local time compared with UTC dates.
- `get_driver_positions` builds its default window from naive local time while OpenF1 dates are UTC.
- `/pit` fields `pit_in` / `pit_out` do not exist, so the pit flag is always false.
- `get_session_details` references an undefined `drivers_lookup` (guarded by a condition that is never true, so dead code).
- Hardcoded driver-number hack: `"33" → "1"` (Verstappen) for OpenF1 lookups.
- Contract drift: the UI reads `race_control_messages`, `track_status`, `driver_positions` from `session-details`, but the backend returns none of them.
- Frontend calls two routes that do not exist (`/races/{year}/`, `/get_race_result/...`).
- `DriverInfoTab` displays random numbers as driver telemetry.

### Error handling
- Blanket `except Exception` returns `str(e)` to the client, leaking internals. Upstream 4xx are mapped to 500. Bare `except: pass` swallows errors silently.
- `utils.make_api_request` exists but is unused. Logging is via `print` in one place and `console.error` on the frontend.
- Frontend error states are generic, and there are no empty states for partial data.

### Security and settings
- `SECRET_KEY` falls back to the hardcoded `'default-secret-key'` when the env var is missing.
- `.env.exemple` (typo) suggests `DJANGO_ALLOWED_HOSTS="*"`.
- `CSRF_COOKIE_SAMESITE='None'` with `CSRF_COOKIE_SECURE=True` and `CORS_ALLOW_CREDENTIALS=True` for a read-only public API: credentials are not needed. Secure cookies also break local HTTP dev.
- `get_driver_positions` interpolates unvalidated query params (`start_date`, `end_date`) and a `<str:session_key>` into the upstream URL, allowing parameter injection into OpenF1 requests.
- Admin is exposed at `/admin/`, and there is no `SECURE_*` hardening for production.
- The browser calls `api.multiviewer.app` directly (third-party request from the user's browser).
- `package-lock.json` is both committed and listed in `.gitignore`, so dependency installs are not reproducible.

### Engineering hygiene
- No tests, no CI, no README, no licence, no Docker, no type checking, no formatter config.
- Single 640-line `views.py`. Pages of 600–700 lines mixing data fetching, formatting and markup. Helpers duplicated across files (`getTeamLogo`, `getHighResHeadshot`, `getSessionType` ×3).
- Mixed languages (French UI strings and comments, English code).
- Commit history contains non-descriptive messages (`Todoo`, `Changes`).

## 7. Consequences for v2

1. Ingest once, serve many: providers → Postgres via idempotent Celery tasks. Views never call upstream APIs.
2. One HTTP client per provider with timeout, retry with exponential back-off, rate limiting (OpenF1 free tier) and response caching.
3. All timestamps stored as timezone-aware UTC. Local session time derived from circuit timezone, never from the browser's.
4. Typed contract end to end (DRF serializers → OpenAPI → generated TS types), checked in CI.
5. No protected assets. Team colours only.
6. Focus on strategy (stints, degradation, pit loss, undercut, pit exit prediction) rather than timing or standings.
