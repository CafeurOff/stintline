# 0009. Driver portraits from Wikipedia when no official portrait applies

- Status: Accepted (maintainer decision, 2026-11-03)
- Complements ADR 0006 (official media references)

## Context
The hub (Phase 7) shows drivers everywhere: profiles, photo grids, the photo driver picker on the circuit and podiums. Official portraits (ADR 0006) only exist for drivers who raced from 2023, through OpenF1 media ids. Every earlier driver, back to 1950, would otherwise be an avatar with initials. The maintainer asked for Wikipedia photos when no official portrait is available.

## Decision
- `racedata.providers.wikipedia` asks the English Wikipedia API for the lead image of each driver's article (the Jolpica `url`), with `prop=pageimages&pilicense=free`. Only freely licensed images are returned, never fair-use files. A second call (`prop=imageinfo`, `extmetadata`) reads the author and the licence.
- Only the thumbnail URL (500 px, a standard Wikimedia size), the author, the licence and the file page URL are stored, in `DriverPortrait` (one row per driver, separate from the biography so a reference import never erases it). Images are never downloaded or re-hosted.
- Precedence in the UI: official portrait, then Wikipedia portrait, then the original avatar (number, code or initials in the team colour). Every image falls back to the avatar when it fails to load.
- Attribution: the driver profile shows "Photo: author, licence" linking to the Commons file page and the licence. Lists and avatars carry a general credit note pointing to the profiles.
- Refresh: `manage.py ingest_portraits [--season]`, and weekly through Celery beat (`refresh_portraits`). Wikipedia allows serial API use with a descriptive User-Agent; the client keeps one call per second.

## Consequences
- 547 of 866 drivers with a Wikipedia article had a free lead image on 2026-11-03. The rest keep the avatar.
- The lead image is chosen by Wikipedia editors: it is usually a portrait but can be a car or a group photo. Acceptable for a fan hub; a manual override can be added later if needed.
- A licence (CC BY-SA, CC BY, public domain, OGL) travels with every image, so the credit can always be shown.
