# Design guide (ADR 0023, frame from ADR 0016)

StintLine is a data hub for F1 fans with a night-race look: a black ground, frosted cards lit
by team and circuit colours, light trails, and real figures everywhere.

## Frame
- Sidebar with icons (`lucide-react`), grouped: race weekend, championship, analysis,
  paddock, about. The active link is a solid ink pill. On desktop it folds into a rail of
  icons (`[` key, remembered). Phones get a top bar and a drawer.
- Frosted sticky top bar: next session with the time left, theme.
- Content up to 1840 px wide, 16 px gutter on phones.

## Building blocks
| Block | Use |
| --- | --- |
| `.glass` | Frosted surface: every card, panel, tile, secondary button. |
| `.glow` + `--glow` | Lights a card from a corner (`--glow-x`, `--glow-y`) in a team or circuit colour. |
| `Trails` (`components/layout`) | Light trails across a hero band, in the context colour. |
| `AmbientTrack` (`components/layout`) | Tilted circuit with a car of light lapping it. |
| `.watermark` | Hollow number, position or code behind a subject (size with `cqw` in an `@container`). |
| `PageHeader` | Lit title band: eyebrow, `.display` title, intro, filters; `colour` and `aside` props. |
| `GlassCard`, `PillSwitch`, `MoreLink`, `IconBubble` | Cards with a title, two-to-four way switches, "see all" links, icon holders. |
| `pillPrimary` / `pillGlass` | Main action (ink on ground) and secondary action (frosted). |
| `Panel`, `Tile`, `KeyFigures` | Sections with a title, key figures, rows of small figures (ADR 0016, restyled). |
| `Bust` | A driver from head to chest, cropped from the full-length official portrait (sharper copy via `lib/portrait.ts`), faded at the bottom. Use it whenever a driver must fill a card. |
| `components/charts/` | `useZoom`, `ZoomLayer`, `ChartTools`, `ChartTooltip`, `ClipArea`: every chart zooms into a dragged box, reads values under the pointer and has +, − and reset buttons; `ChartTools` also copies the chart's link, saves a PNG and downloads its data as CSV. |
| `Term` / `TermList` | A racing or statistics word explained on hover, focus or tap (one glossary in `lib/i18n/glossary.ts`); `PageHeader terms` lists the page's words under its intro. |
| `Skeleton`, `SkeletonTiles` | Loading placeholders of the final block's height, so nothing below jumps when data arrives. |
| `Face`, `Move`, `RoundBars`, `Flag` | Driver photo or code, places gained or lost, one bar per race, flags. |

## Type and colour
- Archivo only. Titles: `.display` (expanded, heavy). Timing figures: `.timing` (condensed,
  thin). Every figure: `.num` (tabular).
- Tokens in `src/index.css`. Race red for live state and actions. Team colours identify
  drivers and teams; circuits get a fixed accent (`circuitAccent`). Text in a context colour
  uses `readable()`. Timing colours keep their meaning: `t-purple` fastest, `gain` green,
  `t-yellow` flags and sprints, `loss` red.
- Radius: 24 px hero bands, 20 px cards, `rounded-xl` buttons and inner blocks.

## Motion
- `.reveal` on cards (rise on scroll into view), `tick` on changing timing figures, slow
  glints on trails, a lapping car on track maps. Nothing else moves. Reduced motion stops all.

## Content rules
- Never show the full-length portrait small: crop it with `Bust`; full-length only when it fills a tall hero (home winner).
- Every chart is interactive: zoom into a box, tooltip with values, crosshair; lines can be picked by clicking.
- Technical upgrades are drawn on the team's own car render with numbered lights.
- Photos and cars never overlap text or each other awkwardly (a car stands beside a driver).
- No empty column; facts are tagged cards with a colour bar; no engine badges.
- Public pages never show commands or setup text.
- Nothing moves once shown: a block that loads after the page holds its space with a placeholder of
  its height, filters that fill in late are drawn (disabled) from the start, and `PageHeader`
  keeps its text at least 30rem wide so late filters wrap below it. Check with a layout-shift
  trace (Playwright `PerformanceObserver`, or Lighthouse CLS ≈ 0).
- The page's main picture (LCP) is fetched first: `priority` on `Face` or `Bust`.

## Checking a page
Run a dev server against real data (`VITE_API_PROXY_TARGET=http://localhost:8000` or the demo
stack on 8080) and screenshot every page at 1600 px and 390 px, in dark and light. For speed
and heads, measure the demo stack (`make demo-up`): it is the only setup with nginx (gzip) and
the pages rendered by the API.
