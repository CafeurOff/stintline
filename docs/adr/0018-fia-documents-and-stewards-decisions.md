# 0018. FIA documents and stewards' decisions

- Status: Accepted (maintainer validated the Phase 14 plan on 2026-11-13: seasons 2025 and 2026, extracted text stored)
- Date: 2026-11-13

## Context
Fans follow penalties through the FIA's own documents: dozens of PDFs per Grand Prix on fia.com
(decisions, summons, classifications, technical reports). They are hard to search, and nothing
ties a ruling to the race it changed. fia.com has no API; its robots.txt asks for 10 s between
requests. Browsers cannot load the PDFs in a viewer of ours (no CORS).

## Decision drivers
- Respect fia.com: one request per 10 s, whatever the number of processes; no bulk mirroring.
- Copyright: show the FIA's documents as theirs, with a link; do not redistribute the files.
- Useful to fans: search, read in the page, see each ruling on the driver, session and lap.
- Zero budget, no new service; tests without network.

## Options considered
### Link to fia.com only
- Pros: nothing to relay. Cons: no reading in the page, no text search, the PDF opens elsewhere.

### Store the PDFs (S3, disk)
- Cons: redistributes the files, about 1 GB for two seasons, a storage cost.

### Relay on request, keep the extracted text (chosen)
- Pros: the page shows the PDF with pdf.js; search works on the text; nothing to host.
- Cons: a request may reach fia.com (the only place a view leads to an upstream call), so it
  waits for the shared slot and is cached.

## Decision
- `racedata.providers.fia` parses the season and event pages with the standard library and the
  PDF text with `pypdf` (BSD), reads stewards' decisions (car, driver, session, time, fact, rule,
  ruling, reason) and turns the ruling into typed penalties (time, drive-through, stop-go, grid,
  back of grid, pit-lane start, points, reprimand, fine, disqualification, lap deleted, no
  further action).
- `stintline.paddock` stores `FiaDocument` (URL, title, category, published_at, cars, text),
  `FiaEventListing` and `StewardsDecision` (driver, session and lap linked). A Celery beat task
  every 30 minutes lists active weekends and events never listed (6 pages a run) and reads 40
  PDFs (stewards' documents first); `manage.py ingest_fia` does the same on demand. Seasons in
  `FIA_SEASONS` (2025, 2026).
- One fia.com request per `FIA_REQUEST_INTERVAL_S` (10 s) across processes: an atomic slot in
  the shared cache, on top of `racedata`'s own limiter. A reader opening a PDF raises a flag so
  the import steps aside; the reader waits at most 12 s, then gets HTTP 429 with `Retry-After`.
- `GET /documents/{id}/pdf` relays the PDF (cached a week, never written to disk). This is the
  one exception to "views never call upstream", kept in `paddock.relay` behind `racedata`.
- Web: `/documents` (Grand Prix picker, category filter, full-text search with snippets, pdf.js
  viewer `pdfjs-dist` 4.10 (Apache-2.0) loaded on demand, text alternative, the ruling with a
  link to the lap); decisions on the Grand Prix page (table and marks on the lap chart) and on
  the driver profile. `pdfjs-dist` 5+ needs Node 22.13; the project is pinned to 22.12.

## Consequences
- Positive: rulings become data (penalties per driver, per race, on the lap); Phase 15
  (technical: upgrades, power units, incidents) reads the same documents.
- Negative / risks: fia.com markup can change (fixtures and tests catch it at the next record);
  a season's backlog takes about a day at 10 s per PDF; the incident time is when the stewards
  noted it, so a lap can be late. Unreadable PDFs are marked read with no text.
- Follow-ups: Phase 15 parses "Car Presentation Submissions" and power-unit documents from the
  stored list.
