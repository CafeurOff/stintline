# 0019. Technical pages from the FIA technical documents (pdfplumber)

- Status: Accepted (maintainer validated the Phase 15 plan on 2026-11-13: 3 races either side of
  an upgrade, `pdfplumber` added)
- Date: 2026-11-13

## Context
Phase 14 (ADR 0018) stores every FIA document of 2025 and 2026. Three of them are tables a fan
cares about: "Car Presentation Submissions" (each team's upgraded parts), "PU elements used per
driver up to now" (running totals per car) and "New PU elements for this Competition" (each new
element, its count, the season's allowance and whether it complies). `pypdf` returns their text
with the columns mixed, and the 2026 power-unit header sits on two lines ("MGU / -K").

## Decision drivers
- Facts only: what the documents state, no invented costs or projections.
- One request per 10 s to fia.com (ADR 0018); no second download of a PDF already read.
- Tests on recorded fixtures, no network.

## Options considered
### pypdf text and regular expressions only
- Cons: columns and multi-line cells interleave; the power-unit columns cannot be told apart.

### pdfplumber (chosen)
- Pros: cells and words with positions; tables come out row by row; columns are placed by x.
- Cons: a new dependency (MIT, pure Python on top of pdfminer.six); slower than pypdf, used
  only on these three documents.

## Decision
- `racedata.providers.fia_technical` parses the three documents with `pdfplumber`:
  upgrades (team, number, component, reason, geometric difference, description; teams that
  declared none), power-unit usage (columns placed by the header's x positions, codes split
  over two lines merged), new elements (element, count, allowance and compliance from the
  FIA's own sentence, including "the above drivers").
- `paddock.readers` lets other apps register a reader for document titles; the import hands
  them the PDF bytes it already fetched, and reads these documents right after the stewards'
  ones. `stintline.technical` stores `CarUpgrade` (with a car zone for the drawing),
  `TeamWithoutUpgrade`, `PowerUnitUsage` and `PowerUnitChange`; `manage.py read_technical`
  re-reads them after a parser change.
- Pace around an upgrade (engine figures, ADR 0017): the team's fuel-corrected gap to the
  field, median over the 3 races before and over the upgrade race and the 2 after, shown only
  with at least 2 races on each side. Penalty points count over 12 months; 12 bring a ban.
- Allowances come from the FIA's sentences ("the seventh of the four new ICE allowed"), not
  from a table of ours.

## Consequences
- Positive: the technical page shows real data (upgrades heatmap, parts on a car drawing,
  power-unit matrix against the allowance, incidents and licence points).
- Negative / risks: the layout of these PDFs can change (teams format their own pages); some
  pages are pictures only and are skipped. Removing images from a fixture also removes table
  borders, so the upgrades fixture keeps 5 original pages instead.
- Follow-ups: Phase 19 "driver form" and "season review" can reuse incidents and upgrades.
