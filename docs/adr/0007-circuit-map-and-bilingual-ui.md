# 0007. Circuit-first interface and bilingual UI

- Status: Accepted (maintainer decision, 2026-11-03)
- Date: 2026-11-03

## Context
The first Phase 5 interface was a dashboard: stacked cards, tables, stat tiles and charts. The maintainer found it hard to read and generic. A mock-up built around the circuit, with cars moving on the real track and simulations shown where they happen, was approved instead. The maintainer also asked for a French version.

## Decision drivers
- Understandable by someone who is not a strategist: one question, one answer, shown on the track.
- No new data source and zero budget (ADR 0002).
- Strict TypeScript and no network in tests.

## Options considered
### Circuit outline
- Third-party circuit geometry (for example the MultiViewer circuits API used by v1). Cons: unofficial, unversioned, outside our provider layer.
- **OpenF1 `location` for one reference lap per race.** Pros: same provider, one bounded request (about 320 samples), recorded as fixtures like everything else. The samples are evenly spaced in time, so a fraction of the lap maps directly to a point. Cons: the drawing is one car's racing line, without the pit lane.

### Car positions during the replay
- Stream every car's `location`. Cons: about 370,000 rows per race and beyond the free rate limit.
- **Interpolate from line-crossing times already stored** (`/replay`). Pros: about 30 KB per race, exact at each line crossing. Cons: positions inside a lap assume the reference lap's speed profile.

### Translations
- i18next with react-i18next. Pros: standard, plurals. Cons: two dependencies and runtime key typing for a small vocabulary.
- **Typed dictionaries in `src/lib/i18n`.** Pros: no dependency; `fr.ts` is typed against the English keys, so a missing translation fails the build; formatting through `Intl`. Cons: plural rules handled by explicit keys.

## Decision
- Ingestion stores a `TrackOutline` per race from the fastest clean lap (`racedata.derive.reference_lap`). `GET /sessions/{id}/track` returns it in screen coordinates and `GET /sessions/{id}/replay` returns line-crossing times, compounds and tyre ages. A missing outline never blocks timing data; the UI then works without the map.
- The race view is the circuit with the replay. The pit-stop and undercut simulators draw a "ghost" car where the driver would rejoin, with the model's uncertainty as a zone along the track.
- The UI is bilingual (English and French): browser language by default, choice stored locally, numbers and dates formatted per language. Grand Prix names and the model's assumption texts are translated in the UI; API messages stay in English.

## Consequences
- Positive: the main view explains itself; the replay costs one small request per race; translations are checked at compile time.
- Negative / risks: positions between line crossings are approximate (no pit lane drawing), and assumption translations must follow engine changes. Mitigation: the API's English text is the fallback for any untranslated assumption.
- Follow-ups: draw the pit lane from an in-lap trace; Phase 6 live mode feeds the same map.
