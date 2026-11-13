# Data sources

What each source provides, how often, with what limits and under which terms. Decisions are in [ADR 0002](adr/0002-data-sources-and-live-strategy.md). Background research is in [research/live-data-landscape.md](research/live-data-landscape.md).

Last verified: 2026-11-11 (news feeds), 2026-11-03 (the rest).

## Summary

| Source | Used for | Freshness | Limits | Auth | Terms |
| --- | --- | --- | --- | --- | --- |
| OpenF1 REST (free) | Historical laps, stints, pit, race control, weather, intervals, drivers, sessions, and car data plus positions over each driver's fastest lap (2023+) | After the session (~30 min, to be measured) | 3 req/s, 30 req/min | None | Unofficial community API, free. Data originates from FOM timing |
| Jolpica | Calendar, sessions schedule, results, pit stops, circuits (1950+) | After the session | ~4 req/s burst, ~500 req/hour (to confirm against jolpica-f1 docs). Pages of max 100 rows | None | Open-source Ergast successor, free |
| Official live timing (SignalR Core) | Live mode only, run locally | Real time (sub-second deltas) | Unknown, single connection | None for the topics we use | formula1.com terms: personal, non-commercial use. Cloud IPs reportedly blocked |
| FastF1 | **Not used** | — | Needs F1 TV account since Oct 2026 | F1 TV | — |
| News feeds (RSS 2.0) | Headlines on the news page (title, link, date only, ADR 0012) | Every 30 min | One request per feed per run | None | Links to the publisher's article; nothing republished |
| fia.com event documents (ADR 0018) | Documents page, stewards' decisions linked to drivers, sessions and laps (2025, 2026) | Every 30 min during a weekend | robots.txt: 10 s between requests, shared by every process | None | © FIA. PDFs relayed on request, never stored; extracted text kept for search |

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

- `team_radio` gives one URL per message; StintLine stores the reference only. An empty result set is HTTP 404 `{"detail":"No results found."}`, read as an empty list.
- `car_data` is not ingested. `location` is fetched for one reference lap per race only (the fastest clean lap, about 320 samples) to draw the circuit (ADR 0007).
- Free tier: no live data. Sponsor tier (live, MQTT or WebSocket) is not used (ADR 0002).
- Pitfalls: `lap_duration` is null on some laps (lap 1, pit-out, deleted). `compound` can be `UNKNOWN`. Requests that are too large return errors, so query per session and per driver.

### Car data (ADR 0013)
- `car_data?session_key=…&driver_number=…&date>…&date<…`: `speed` (km/h), `throttle` (%), `brake` (0 or 100), `n_gear`, `rpm`, `drs`, about 3.7 Hz. Always bounded to one lap (~300 rows); a race is ~20,000 rows per car.
- Paired with `location` over the same window. Fixtures: the Hungarian 2025 podium's fastest laps (`car_data/` and `location/`, session 9928, cars 4, 81 and 63).
- 2026 cars have no DRS: the channel stays at 0.

## Jolpica
- Base URL `https://api.jolpi.ca/ergast/f1`. Ergast-compatible schema (`MRData.RaceTable…`).
- Endpoints used: `/{season}/races/`, `/{season}/{round}/results/`, `/{season}/{round}/pitstops/`, `/{season}/{round}/laps/` (cross-check), `/{season}/drivers/`, `/{season}/constructors/`.
- Session times are `date` + `time` in UTC (`Z`), and can be missing for old seasons.
- Pagination: `limit` (max 100) and `offset`. Read `MRData.total`.

### Season-wide endpoints (Phase 6)
- `{season}/results`, `{season}/sprint` and `{season}/qualifying` return every round of a season in pages of 100 rows; a round can span two pages (merged on `round`).
- `{season}/driverstandings` and `{season}/constructorstandings` give the table after the last round; `{season}/{round}/…` after a given round. The constructors' championship starts in 1958 (empty before).
- `drivers`, `constructors` and `circuits` give biographies (884, 214 and 78 rows in Nov 2026).
- Results rows carry `Time.millis`, `FastestLap.rank` and the driver's biography. Early seasons contain shared drives (two drivers, one car); StintLine keeps the first row and reports the others.

## Wikipedia (driver portraits, ADR 0009)
- API: `https://en.wikipedia.org/w/api.php`, no key. One call per second with the StintLine User-Agent.
- `action=query&prop=pageimages&piprop=thumbnail|name&pithumbsize=500&pilicense=free&redirects=1&titles=…` (50 titles per call) gives the free lead image of each driver's article. Titles come from the Jolpica driver `url`.
- `action=query&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl&titles=File:…` gives the author and licence to display.
- Thumbnail URLs carry analytics query parameters; the provider strips them. Images are referenced, never downloaded.
- Fixtures: the 2025 grid and four historical titles (including one missing article) under `fixtures/wikipedia/`. Long queries get a hashed fixture file name (`racedata.fixtures.MAX_SLUG_CHARS`).

## News feeds (ADR 0012)
- `racedata.config.FEEDS`: Autosport (`https://www.autosport.com/rss/f1/news/`), RaceFans (`https://www.racefans.net/feed/`), F1i (`https://f1i.com/feed/`) in English; Motorsport.com France (`https://fr.motorsport.com/rss/f1/news/`) in French. All RSS 2.0, checked on 2026-11-11.
- Not used: formula1.com `latest/all.xml` (no dates), The Race (mixes F1 and MotoGP), Motorsport.com English (HTTP 502 when checked), L'Équipe and AutoHebdo (blocked automated readers).
- Only title, link (tracking parameters removed), date and language are kept. Some titles end with a section label (`… | Formula 1`), which the parser removes.
- Fixtures: `fixtures/feeds/<key>/<path>/_.xml`, 12 items each, headline fields only (`record_fixture feeds <key>`).

## fia.com event documents (ADR 0018)
- Season pages: `documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071` and `…/season-2026-2072` (`racedata.config.FIA_SEASON_PAGES`). They list the Grands Prix (`.event-title`).
- Event pages: `<season page>/event/<name>`. Each `li.document-row` holds the PDF link (`/system/files/decision-document/…pdf`), "Doc N - Title" and "Published on DD.MM.YY HH:MM CET". The label is always "CET" but the time is Paris wall-clock time (CEST in summer): it matches the time printed in the PDF. Recalled documents have no link.
- robots.txt (checked 2026-11-13): `Crawl-delay: 10`, nothing we read is disallowed. One request per 10 s across the worker and the API, with a slot in Redis; a reader opening a PDF goes before the background import.
- Decision PDFs follow one template (`No / Driver`, `Competitor`, `Time`, `Session`, `Fact`, `Infringement` or `Offence`, `Decision`, `Reason`); text is extracted with `pypdf`, no-break spaces normalised. The header's local issue time against the publication instant gives the circuit's UTC offset, which places the incident on a lap. The incident `Time` is when the stewards noted it (an unsafe release can read as the last lap).
- FIA event names differ from ours ("São Paulo" for "Brazilian", "Barcelona-Catalunya", "Bahrain" for "Bahrain Grand Prix in Malaysia"): matched by words, then by the circuit's city. Test sessions are skipped.
- Volume: about 1,350 documents a season, 330 KB per PDF, about 350 stewards' documents.
- Fixtures: `fixtures/fia/<path>/_.html` (2025 season page, 2025 Hungarian Grand Prix) and `_.pdf` (its seven stewards' documents and the final classification, images removed) via `record_fixture fia <path>`.

## Official live timing feed (local live mode)
- Hub: `wss://livetiming.formula1.com/signalrcore` (SignalR Core, JSON protocol). An `OPTIONS` on `/signalrcore/negotiate` provides the `AWSALBCORS` cookie, then the client invokes `Subscribe([topics])`. The reply is a full snapshot, then incremental `feed` messages `[topic, payload, timestamp]` that merge into the snapshot.
- Topics we use: `SessionInfo`, `SessionStatus`, `DriverList`, `LapCount`, `TimingData`, `TimingAppData` (stints: `Compound`, `New`, `StartLaps`, `TotalLaps`), `TyreStintSeries`, `LapSeries` (position per lap), `TrackStatus` (`1` clear, `2` yellow, `4` SC, `5` red, `6` VSC, `7` VSC ending), `RaceControlMessages`, `WeatherData`, `PitLaneTimeCollection`, `ExtrapolatedClock`.
- Not available without auth: `CarData.z`, `Position.z` (not needed).
- `SessionInfo.StartDate` is circuit-local, with a separate `GmtOffset`. Convert to UTC in the adapter.
- Usage rules: run from a personal connection, for personal use. Do not redistribute recordings. The public demo never connects to this feed.

## Fixture inventory
Recorded responses in `packages/racedata/fixtures/<provider>/<path>/<params>.json`, used by tests and `seed_demo`. Each fixture has a `.meta.json` file (URL, params, recorded_at, sha256, dropped fields). Record new ones with `/new-provider-fixture`. Dropped fields: lap mini-sectors (size) and driver `headshot_url` (official imagery). Total size is about 4.6 MB.

| Fixture | Source | Purpose |
| --- | --- | --- |
| `jolpica/2025/races` | Jolpica | 2025 calendar (24 rounds, UTC session times) |
| `openf1/sessions` (`year=2025`, plus `year=2025` races only) | OpenF1 | Session keys for matching |
| `openf1/{drivers,laps,stints,pit,race_control,weather}` with `session_key` 10014, 9928 and 9912 | OpenF1 | 2025 Bahrain (R4, Safety Car laps 32–35), Hungarian (R14) and Italian (R16) Grands Prix |
| `jolpica/2025/{4,14,16}/{results,pitstops}` | Jolpica | Classification (identity, car numbers) and published pit-stop durations |
| `openf1/team_radio` for the nine races | OpenF1 | Team radio references (URLs to official recordings, never downloaded) |
| `jolpica/2025/{results,sprint,qualifying,driverstandings,constructorstandings}` and `2025/{1..24}/{driverstandings,constructorstandings}` | Jolpica | Full 2025 classifications and the title fight round by round (`seed_demo`) |
| `jolpica/{drivers,constructors,circuits}` | Jolpica | Biographies since 1950 |
| `jolpica/1950/*` | Jolpica | A pre-timing season for history tests (shared drives, final standings only) |
| `openf1/location` for each of the nine races, bounded by `date>` and `date<` to the reference lap | OpenF1 | Circuit outlines |
| Same endpoints for `session_key` 10006, 9971, 9955, 9920, 9877, 9839 and rounds 3, 9, 11, 15, 20, 24 | OpenF1 + Jolpica | Held-out backtest races: Japan, Spain, Austria, Netherlands, Mexico City, Abu Dhabi (`seed_demo --backtest`) |

Observed quirks, all covered by tests:
- Jolpica `permanentNumber` reflects the current season (Norris shows `1`, but raced `4` in 2025).
- OpenF1 `stop_duration` is often `null` while `lane_duration` is set.
- One Hungarian lap has a `null` duration.
- Jolpica pit `time` is circuit-local.

## Attribution
Data courtesy of [OpenF1](https://openf1.org) and [Jolpica](https://github.com/jolpica/jolpica-f1). Driver photos from [Wikimedia Commons](https://commons.wikimedia.org), credited on each profile with their author and licence. Formula 1 timing data © Formula One World Championship Limited. StintLine is unofficial and not associated with Formula 1, the FIA or any team.
