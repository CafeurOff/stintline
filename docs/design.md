# Design guide (ADR 0016)

StintLine is a data dashboard for F1 fans. Pages must feel full: every element shows real data.

## Frame
- Sidebar with icons (`lucide-react`), grouped: race weekend, championship, paddock, about.
  Phones get a top bar and a drawer. Top bar: next session with the time left, theme.
- Content up to 1840 px wide, 16 px gutter on phones.

## Building blocks (`apps/web/src/components/dash/`)
| Block | Use |
| --- | --- |
| `Panel` | Any section with a title: icon + title on the left, filters or links on the right, content below. Tables always live in a panel. |
| `Tile` | One key figure: label, icon square, a big `.num` value, a driver line or `RoundBars`. Use 4 per row on desktop. |
| `Face` | Driver photo (official, else Wikipedia), else the code on the team colour. |
| `Move` | Places gained or lost since the previous round (arrow + count, screen-reader text). |
| `RoundBars` | One bar per race under a figure (hit, sprint outline, miss, retirement). |
| `Flag` (`components/racing`) | Country flag from `flag-icons`, decorative next to the name. |
| `PageHeader` | Page title in sentence case, short intro, filters as pills on the right. |
| `KeyFigures` | A row of small figure tiles. |

## Type and colour
- Archivo for text; IBM Plex Mono through `.num` for every figure (times, points, gaps).
- Titles in sentence case, bold. Small uppercase only for table headers and tags.
- Tokens in `src/index.css`. Race red (`action`, `mark`) for live state and primary actions.
  Team colours identify drivers and teams (tints with `teamTint`). Timing colours carry
  meaning: `t-purple` fastest, `gain` green, `t-yellow` flags and sprints, `loss` red.
- Radius: `rounded-xl` for panels and tiles, `rounded-lg` for buttons and pills.

## Content rules
- No empty column: if a column ends early, add a panel of related data.
- Facts are tagged cards (driver, team, race) with a flag and a date.
- Lists of news show the publisher's picture (ADR 0015) or an icon tile.
- No gradients except the race-red countdown stripes; no glows; no decorative text.
- Public pages never show commands or setup text.

## Checking a page
Point the dev server at a stack with real data and take screenshots at 1600 px and 390 px:
`VITE_API_PROXY_TARGET=http://localhost:8080 pnpm --filter web dev` (the demo stack), then
review every page as a fan would.
