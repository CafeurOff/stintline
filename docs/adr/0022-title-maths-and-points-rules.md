# 0022. Title maths from a table of points rules since 1950

- Status: Accepted (maintainer validated Phase 19 on 2026-11-19)
- Date: 2026-11-19

## Context
Fans ask "who can still be champion?" and "what does the leader need this weekend?". The
answer is pure arithmetic, but it depends on rules that changed many times: the points of a
win (8, 9, 10, 25), a fastest-lap point (1950–1959, 2019–2024), sprints (2021 onwards), a
double-points finale (2014) and, until 1990, dropped results (best 4, 5, 6 or 11 results;
from 1967 to 1980 each half of the season with its own count). Ties go to the countback.

## Decision drivers
- Exact, never approximate: a wrong "X is champion" is worse than no sentence.
- No new provider, no new table: everything comes from stored results.
- Checkable: the rules must reproduce the official standings we already store.

## Options considered
### Rules as code, checked against the stored standings (chosen)
- Pros: three facts per season are enough (most points from a Grand Prix, from a sprint,
  which results count); `check_title_rules` recounts every season and lists differences.
- Cons: a new season with new rules needs a line of code.

### Read the counted points from Jolpica's standings
- Cons: gives today's points but not the ceiling with dropped results; and Jolpica is wrong
  in places (1967: Brabham 48 instead of 46, his points before dropped results; 1977: Lauda
  70 instead of 72, Reutemann 41 instead of 42).

### A full per-position points table per season
- Not needed: only the maximum of a race matters for title maths. Kept for the eras
  comparison (idea 6), which needs the whole scale.

## Decision
- `stintline.championship.rules`: `rules_for(year)` gives `race_max`, `sprint_max`,
  counting blocks (`CountBlock(races, best)`) and `double_last_race`. Source: the FIA rules
  as listed on Wikipedia ("List of Formula One points systems").
- `stintline.championship.maths` (no ORM): counted points, ceiling (every race left won,
  with the fastest lap where it paid), statuses (champion, leader, contender, out),
  countback (wins, then second places...; the rival's best case adds every race left as a
  win), the leader's margin to clinch at the next round (seasons where every result counts),
  and the first round after which the title was settled.
- `selectors.title_state(year, today)`: per-round tallies from `SessionEntry` (Grands Prix
  and sprints), classified places for the countback, rounds still to come (an unrun round
  counts up to 3 days after its date; older ones were cancelled). `GET
  /api/v1/seasons/{year}/title`. `manage.py check_title_rules [--season]`.
- Web: a "Title maths" panel on the drivers' standings (sentence, bar per driver from what
  counts today to what they can reach, the leader's line) and the same sentence on the
  home page's leader tile once the title is settled or settable.

## Consequences
- Positive: verified on every stored season. Champions match the official ones from 1950;
  the rounds the titles were settled match history (Senna at Suzuka 1988 on countback,
  Mansell in Hungary 1992, Verstappen in Qatar 2023, Antonelli in Mexico 2026). Counted
  points match the official tables from 1958, except where Jolpica is wrong (1967, 1977).
- Negative / risks: before 1958, points from shared drives and shared fastest laps are
  missing from the race results, so a few drivers' totals are short by 1 to 5 points (the
  champion and the round are unaffected). Countback on dropped-results seasons uses every
  classified finish. A season with new rules needs a line in `rules.py`.
