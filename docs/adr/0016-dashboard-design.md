# 0016. Dashboard design for the whole site

- Status: Accepted (maintainer decision, 2026-11-12). Replaces the visual rules of ADR 0014.
- Date: 2026-11-12

## Context
The maintainer found the Phase 12 broadcast design generic ("AI slop"). A minimal "pit wall"
pilot and three mock-ups (paddock dashboard, TV graphics, racing magazine) were then judged
empty. The references the maintainer pointed to are F1 data dashboards: a sidebar with icons,
tiles of real figures, dense tables, tagged fact cards, flags and photos.

## Decision drivers
- Pages that feel full and alive, for casual and hardcore fans.
- Every visual element carries data; no decoration standing in for content.
- Zero budget, free licences, accessibility kept (contrast, keyboard, text alternatives).

## Options considered
- Keep the broadcast style and remove its tics: rejected, the maintainer found it generic.
- Minimal timing-sheet style (hairlines, no panels): rejected, too empty.
- **Dashboard style**: chosen after the maintainer saw it on the home page with real data.

## Decision
- **Frame**: sidebar with icons grouped by intent (race weekend, championship, paddock,
  about), a top bar with the next session, full-width content (up to 1840 px).
- **Building blocks** (`src/components/dash/`): `Panel` (bordered surface with an icon title
  and actions), `Tile` (a key figure with an icon), `Face` (driver photo or code on the team
  colour), `Move` (places gained or lost), `RoundBars` (one bar per race under a figure),
  `Flag` (flag-icons SVG). Page filters are pills (`Select`, `SegmentedControl`).
- **Type**: Archivo for text, IBM Plex Mono (`.num`) for every figure. Titles in sentence case.
- **Colour**: dark navy-black ground, one race red for live state and primary actions, team
  colours for cars and teams, timing colours for meaning (purple fastest, green gain, yellow
  flags and sprints, red loss).
- **Content rules**: every tile shows a real figure; no empty columns (fill them with a panel
  of related data); tables live in panels; facts are tagged cards. Pictures: official
  portraits and car renders (ADR 0006), Wikipedia portraits (ADR 0009), headline pictures
  (ADR 0015), always with a fallback.
- Kept from ADR 0014: public pages never show commands; official portraits by default;
  telemetry zoom.

## Consequences
- Positive: dense, recognisable pages; shared blocks make new pages quick to build.
- Negative / risks: more on screen to maintain; two new front-end dependencies (lucide-react,
  flag-icons). Mitigation: shared components, tests through roles and labels.
- Follow-ups: the analysis hub, paddock and technical pages of `docs/plans/phases-13-20.md`
  use these blocks.
