# 0020. Weather forecasts from Open-Meteo, and a fuller live timing tower

- Status: Accepted (maintainer validated Phase 17 on 2026-11-16)
- Date: 2026-11-16

## Context
Before a weekend, fans ask whether it will rain. During a session they read the timing tower:
mini-sectors in purple, green and yellow, tyres and their age, stops, the flag periods so far,
pit-lane times and the weather. Our live mode (ADR 0011) showed the order, gaps, tyres, a
"pit now" estimate, team radio and race control, and the demo recording rebuilt from a stored
race only carried positions and gaps.

## Decision drivers
- Zero budget, no API key, nothing that needs an account.
- No network in tests; the public demo stays replay-only.
- Facts the feed or our engine gives, never invented values.

## Options considered
### Weather: Open-Meteo (chosen)
- Pros: free for non-commercial use, no key, hourly forecasts 16 days ahead with a chance of
  rain per hour, WMO weather codes, UTC times on request. Licence CC BY 4.0.
- Cons: credit required wherever the data shows; one more provider to watch.

### Weather: national services or paid APIs
- Cons: one service per country, or a key and a price.

### Live flag periods: track history kept by the live process
- Cons: lost on restart. `SessionData.StatusSeries` (with `SessionData.Series` for lap
  starts) already holds the whole session: chosen.

## Decision
- `racedata.providers.openmeteo` (`OpenMeteoSource.hourly`): one call per weekend with the
  circuit coordinates (2 decimals) and the weekend's dates; temperature, chance of rain,
  rain, wind (m/s), weather code. Limit kept at 1 request/s and 500/hour.
- `stintline.forecast`: `SessionForecast` per session (window from the scheduled start: race
  2 h, others 1 h; mean, min and max air temperature, highest hourly chance of rain, total
  rain, strongest wind, most severe weather code, hourly points around the window). Refreshed
  by Celery beat every 3 hours and when a worker starts (`refresh_forecasts`), for sessions
  starting within 15 days and until 3 hours after their start. `GET /api/v1/forecasts
  [?event=]`. Shown on the calendar cards, the home countdown, the Grand Prix page and the
  offline live page, always with the Open-Meteo credit.
- Live view (`racedata.live.snapshot`): sectors with their last time, personal and overall best
  flags and coloured mini-sectors (`2048` yellow, `2049` green, `2051` purple, `2064` pit
  lane), starting position, flag periods from `SessionData` (yellow, SC, VSC, red; earlier
  sessions of the weekend left out), pit-lane times and one weather reading per lap kept by
  `SessionHistory` (the feed deletes pit times after a while).
- Live page: timing tower with mini-sectors and places won, race timeline, gap ring with the
  rejoin window of the selected car (gap + pit loss ± one standard deviation, the same model
  as "pit now"), pit-lane panel (latest stops, average, quickest, team averages), weather strip,
  race control tagged with its lap, flag and stewards.
- `live_demo` now writes sector times and colours (stored laps have no mini-sector times: each
  mini-sector takes its sector's colour), lap and status series, race control, pit-lane times
  and weather at the race time they happened. Gaps are measured at the car's position on the
  leader's path, so they follow the running order.

## Consequences
- Positive: weekend weather everywhere a fan looks; a live page close to a pit-wall screen,
  replayable from any stored race.
- Negative / risks: the Open-Meteo fixture was built by hand from the documented format (no
  network from the development session); record a real one with
  `record_fixture openmeteo forecast …`. Segment status codes other than the four known ones
  count as yellow. Pit-lane times seen before a restart of the live process are lost.
- Follow-ups: the Phase 19 strategy preview can use the forecast temperature.
