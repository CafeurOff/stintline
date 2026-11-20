# History

How StintLine was built, phase by phase. Each phase was planned, reviewed and recorded in the ADRs listed here. This page replaces the v1 audit (`docs/v1-audit.md`) and the phase plan (`docs/plans/phases-13-20.md`) that early ADRs mention.

## Origin: the v1 prototype

StintLine started as "F1 Checker", a prototype with a Django proxy and a React front end (about 7,000 lines, no tests, no types). An audit in November 2026 found that it could not grow into a strategy tool:

- every page called Jolpica and OpenF1 directly, with no cache, no timeouts, no retries and no rate limiting;
- whole sessions of positions and car data were fetched and forwarded raw;
- the front end and the API had drifted apart (routes that did not exist, fields never returned), and naive local times were compared with UTC dates;
- errors were returned to clients as raw exception text, and production settings were not hardened.

No v1 file was carried over. The rewrite kept only the source mapping (which Jolpica and OpenF1 fields answer which question) and a few screen ideas. Its stack and structure are recorded in ADR 0001.

## Phases

| Phase | What was built | ADRs |
| --- | --- | --- |
| 0–2 | Audit, survey of data sources (the official archive locked behind F1 TV in October 2026), monorepo baseline | 0001, 0002 |
| 3–4 | Data model and idempotent ingestion; strategy engine (lap cleaning, fuel, degradation, pit loss, pit exit, undercut) with a backtest on held-out races | 0003–0005 |
| 5 | Versioned API and a bilingual web app built around the circuit: cars replayed on the real track, pit-stop and undercut simulations | 0006, 0007 |
| 6 | Every season since 1950 (results, standings, biographies), team radio, automatic import after each Grand Prix | 0008 |
| 7 | Fan hub: home, Grands Prix by season, Grand Prix page with race analysis, drivers, teams, standings, Wikipedia portraits | 0009 |
| 8 | What-if replay of a whole race with another tyre strategy | 0010 |
| 9 | Local live mode: timing feed, snapshot over WebSocket, team radio, recordings and replays | 0011 |
| 10 | News: race reports written from our data, headline links from RSS feeds, lap telemetry | 0012, 0013 |
| 11 | Polish, README, replay-only public demo | — |
| 12 | Broadcast design for the public site | 0014, 0015 |
| 13 | Dashboard design across the site | 0016 |
| 14 | Paddock: FIA documents and stewards' decisions | 0018 |
| 15 | Technical: upgrades, power-unit elements and incidents from FIA documents | 0019 |
| 16 | Analysis hub: head-to-heads, race pace, consistency, pit stops, track DNA | 0017 |
| 17 | Weekend and live: forecasts, timing tower, flag timeline, pit-lane times | 0020 |
| 18 | Lap altitude and 3D lap replay | 0021 |
| 19 | Title maths: who can still win, and when each title was settled | 0022 |
| — | Night-race glass design, Wikimedia portrait relay, page heads and language addresses | 0023–0025 |
| — | Open-source preparation: comments, folder layout, faster tests, public docs | — |

## Ideas not built yet

Validated as a direction in November 2026, in this order:

- **Driver form**: the last five races as a compact strip (finish, places gained, pace gap to the teammate).
- **Undercut atlas**: how much an undercut gained at each circuit in past races, from the backtest.
- **Strategy preview** before a race: likely one- and two-stop windows from the degradation and pit-loss models, shown next to the forecast.
- **Season review**: a page written from the data at the end of each season.
- **Eras comparison**: points rescaled to today's system to compare drivers across decades.
