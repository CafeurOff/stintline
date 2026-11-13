# apps/web — frontend conventions

Read the root `CLAUDE.md` first. This file only adds frontend-specific rules.

## Layout
- `src/app/`: router, layout shell (icon sidebar grouped by intent with FR/EN, top bar with the next session and the theme; on race pages the race picker and the Circuit / Tyres / Results tabs sit in the top bar), providers.
- `src/features/<feature>/`: `components/`, `api.ts` (TanStack Query hooks), pure helpers, `*.test.ts(x)`. Features: `race` (circuit map, replay clock and maths, photo driver picker, pit-stop, undercut and what-if strategy panels; plans encoded in `strategy.ts`), `tyres` (wear per compound, strategies, wear chart), `model-about`, `session-picker` (race picker dialog over the timed seasons), `home` (home page, not found), `hub` (shared query hooks and current season), `calendar`, `event` (Grand Prix hero, results), `analysis` (race facts, lap charts, sectors; pure maths in `laps.ts`), `drivers`, `teams`, `standings` (tables and title-fight chart), `health`, `live` (status query, WebSocket hook with reconnection, TV-delay buffer in `buffer.ts`, live page), `news` (report and headline queries, `write.ts` turns report facts into an EN/FR article in sections, news page with a headline wire, source filters and a reader that names the drivers and teams of a headline, report pages with charts reused from `analysis` and `telemetry`), `insights` (analysis hub, ADR 0017: head-to-head, race pace, consistency, pit stops and track DNA pages; visx charts in `charts/` (split bar, gap strip, per-round gap bars, pace boxes, lap scatter, pit-loss bars), pure helpers in `duel.ts`, season and driver label helpers in `season.ts`, the "our engine" badge in `components/common.tsx`), `paddock` (FIA documents page: Grand Prix picker, category filter, search with snippets, `PdfViewer` drawing pages with pdf.js loaded on demand and retrying on 429, the ruling with its lap; `DecisionTable` and `PenaltyTags` reused by the Grand Prix page and the driver profile), `telemetry` (fastest-lap comparison: stacked distance charts with a shared pointer, lap drawn on the circuit, braking-zone table).
- Routes: `/` (home), `/calendar/:year?`, `/events/:eventId` (`?session=R|SPRINT|Q&chart=positions|gaps|pace|tyres|sectors|telemetry&drivers=4,81&tele=4,81`), `/drivers` (`?q=&season=`), `/drivers/:ref` (`?season=`), `/teams`, `/teams/:ref`, `/standings/:year?` (`?table=constructors&round=`), `/sessions/:sessionId` (circuit and simulators; `?car=&lap=&mode=stop|undercut|strategy&plan=M-31H`), `/sessions/:sessionId/tyres`, `/model`, `/live` (`?car=`), `/news` (`?lang=all`), `/news/:sessionId`, `/analysis` (`?season=&mode=drivers&a=norris&b=piastri`), `/analysis/pace` (`?season=&session=&fuel=raw&pit=1&sc=1&cutoff=105&drivers=4,81`), `/analysis/consistency` and `/analysis/pit-stops` (`?season=`), `/circuits` (`?sort=pitLoss`), `/circuits/:ref`, `/documents` (`?season=&event=&cat=decision&q=&doc=`).
- `src/components/ui/`: accessible primitives (Button, Select, Slider, SegmentedControl, Dialog on the native `<dialog>`, Skeleton, ErrorState, EmptyState).
- `src/components/racing/`: `CompoundBadge`, `DriverAvatar` (official or Wikipedia photo, else number, code or initials in the team colour).
- `src/components/hub/`: `PageHeader`, `KeyFigures` (a row of label/value pairs), `DriverName` and `TeamName` (linked, with photo or colour bar), `SeasonSelect`, `SeasonBars` (points per season), `ShowAll` + `useCollapsed` for long tables.
- `src/components/racing/` also has `DriverPhoto` (rectangular card photo), `CarImage` (official render, hidden when absent) and `CircuitOutline`.
- `src/lib/`: API client and `unwrap`, `i18n/` (dictionaries, provider, translated content), locale-aware `createFormatters`, compounds, team colours, theme, URL-state and sizing hooks.
- `src/test/`: MSW server and handlers, typed fixtures recorded from the demo API (`fixtures/*.ts`, Hungary 2025, trimmed). Playwright reuses them through `e2e/mockApi.ts`.

## Theme
- Dashboard design (ADR 0016, `docs/design.md`): icon sidebar (`app/Layout.tsx`), filter pills, and the blocks in `src/components/dash/` (`Panel`, `Tile`, `Face`, `Move`, `RoundBars`) plus `Flag`. Icons come from `lucide-react`, flags from `flag-icons`. Every tile shows a real figure; tables live in panels; no empty columns.
- Shared race blocks live in `features/hub/RaceFacts.tsx` (fastest stop, climber, fastest lap, race control tiles and the tagged facts panel), used by the home and Grand Prix pages.
- A table inside a horizontal scroll wrapper needs `relative` on the wrapper (`relative overflow-x-auto`): `sr-only` labels are absolutely positioned and otherwise widen the page on phones. Grids need `grid-cols-1` on phones, or their single column grows to the widest table.
- Tokens live in `src/index.css`: navy-black (dark, default) or paper (light) ground, race red for live state and actions, team colours for cars, timing colours for meaning. Archivo for text, IBM Plex Mono via `.num` for figures (self-hosted). `data-theme="light"` on `<html>` switches; the choice (`stintline-theme`) and the language (`stintline-locale`) are applied before first paint by the inline script in `index.html`.
- Use tokens (`bg-panel`, `text-muted`, `text-mark-text`…), never raw colours. `mark` is a fill; red text uses `mark-text`; buttons use `action`. Compound fills (`--color-tyre-*`) are shared by both themes and always carry a dark letter.

## Language
- Every visible string goes through `t()` from `useI18n()`. Add the key to `lib/i18n/en.ts` and `fr.ts` (typed: a missing French key fails the build). Numbers, durations, ordinals and dates go through `f` (`createFormatters`).
- Grand Prix names and assumption texts are translated in `lib/i18n/content.ts`; API messages stay in English.

## Rules
- TypeScript strict, no `any`, no non-null assertions to silence errors. API types come only from `@stintline/api-types`. Never redeclare them.
- Server state lives in TanStack Query only, with no copy in `useState`. URL state (season, event, session, drivers, lap) goes in search params so views can be shared.
- Every data view has explicit loading (skeleton), empty and error (retry) states.
- Accessibility: keyboard reachable controls, visible focus, labelled inputs (the simulator slider has `aria-valuetext`), WCAG AA contrast in light and dark, colour never the only signal (compounds show letter + colour).
- Charts use the library chosen in its ADR. Each chart has a text summary or table alternative.
- No logos. Official driver portraits and car renders are shown only from the URLs the API returns (ADR 0006), with `referrerPolicy="no-referrer"`, and always fall back to original illustrations (numbered avatar, team-colour silhouette) when absent or broken. Never download or bundle them. Wikipedia portraits (ADR 0009) come second (`entryPhoto`), and the driver profile must show their author and licence.
- Country and nationality names go through `lib/i18n/geo.ts` (ISO codes + `Intl.DisplayNames`). Grand Prix names since 1950 are translated in `content.ts`.
- Every page sets its browser tab title with `useDocumentTitle` (`PageHeader` does it for its title). Pages other than home and not-found are `React.lazy` in `app/router.tsx`, rendered inside the layout's `Suspense`.
- Simulations are queries keyed by their request (not mutations), debounced, with the previous result kept on screen.
- UI copy in English and French (see Language).

## Tests
- Vitest + Testing Library: test behaviour through roles and labels, not implementation. MSW handlers built from the generated types, with no network.
- Playwright locators: use `exact: true` for short names (`fr` also matches "Franco"), and wait for the new page before clicking a link that may exist on the previous one.
- Playwright: home → last race → pit-stop simulation, map selection → undercut, French tyres and model pages, theme persistence, home → drivers → a driver's career. The API is mocked with `page.route`; official media and Wikimedia requests are aborted.
- jsdom has no `<dialog>` methods or layout: `src/test/setup.ts` polyfills `showModal`/`close` and `scrollIntoView`.
- Commands: `pnpm --filter web test`, `pnpm --filter web e2e`, `pnpm --filter web typecheck`, `pnpm --filter web lint`.
