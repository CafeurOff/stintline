# apps/web — frontend conventions

Read the root `CLAUDE.md` first. This file only adds frontend-specific rules.

## Layout
- `src/app/`: router, layout shell (header with the main navigation, FR/EN, theme; on race pages a race bar with the race picker and the Circuit / Tyres / Results tabs), providers.
- `src/features/<feature>/`: `components/`, `api.ts` (TanStack Query hooks), pure helpers, `*.test.ts(x)`. Features: `race` (circuit map, replay clock and maths, photo driver picker, pit-stop and undercut panels), `tyres` (wear per compound, strategies, wear chart), `model-about`, `session-picker` (race picker dialog over the timed seasons), `home` (home page, not found), `hub` (shared query hooks and current season), `calendar`, `event` (Grand Prix hero, results), `analysis` (race facts, lap charts, sectors; pure maths in `laps.ts`), `drivers`, `teams`, `standings` (tables and title-fight chart), `health`; `live` comes in Phase 9.
- Routes: `/` (home), `/calendar/:year?`, `/events/:eventId` (`?session=R|SPRINT|Q&chart=positions|gaps|pace|tyres|sectors&drivers=4,81`), `/drivers` (`?q=&season=`), `/drivers/:ref` (`?season=`), `/teams`, `/teams/:ref`, `/standings/:year?` (`?table=constructors&round=`), `/sessions/:sessionId` (circuit and simulators), `/sessions/:sessionId/tyres`, `/model`.
- `src/components/ui/`: accessible primitives (Button, Select, Slider, SegmentedControl, Dialog on the native `<dialog>`, Skeleton, ErrorState, EmptyState).
- `src/components/racing/`: `CompoundBadge`, `DriverAvatar` (official or Wikipedia photo, else number, code or initials in the team colour).
- `src/components/hub/`: `PageHeader`, `KeyFigures` (a row of label/value pairs), `DriverName` and `TeamName` (linked, with photo or colour bar), `SeasonSelect`, `SeasonBars` (points per season), `ShowAll` + `useCollapsed` for long tables.
- `src/components/racing/` also has `DriverPhoto` (rectangular card photo), `CarImage` (official render, hidden when absent) and `CircuitOutline`.
- `src/lib/`: API client and `unwrap`, `i18n/` (dictionaries, provider, translated content), locale-aware `createFormatters`, compounds, team colours, theme, URL-state and sizing hooks.
- `src/test/`: MSW server and handlers, typed fixtures recorded from the demo API (`fixtures/*.ts`, Hungary 2025, trimmed). Playwright reuses them through `e2e/mockApi.ts`.

## Theme
- The circuit is the interface (ADR 0007). Keep screens to one question and one answer; no dashboards, stat tiles, gradients, glows or decorative cards. Hub pages (ADR 0008) are reference pages: content capped at 1360 px, cards and headers tinted with the team colour (`teamTint`, solid colour mixing, never gradients) with a top border in the team colour, quiet tables (`.data-table`), one row of key figures, photos. Long tables collapse after ten rows.
- Tokens live in `src/index.css`: near-black (dark, default) or paper (light) ground, one race red, team colours for cars, Titillium Web self-hosted. `data-theme="light"` on `<html>` switches; the choice (`stintline-theme`) and the language (`stintline-locale`) are applied before first paint by the inline script in `index.html`.
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
- Simulations are queries keyed by their request (not mutations), debounced, with the previous result kept on screen.
- UI copy in English and French (see Language).

## Tests
- Vitest + Testing Library: test behaviour through roles and labels, not implementation. MSW handlers built from the generated types, with no network.
- Playwright locators: use `exact: true` for short names (`fr` also matches "Franco"), and wait for the new page before clicking a link that may exist on the previous one.
- Playwright: home → last race → pit-stop simulation, map selection → undercut, French tyres and model pages, theme persistence, home → drivers → a driver's career. The API is mocked with `page.route`; official media and Wikimedia requests are aborted.
- jsdom has no `<dialog>` methods or layout: `src/test/setup.ts` polyfills `showModal`/`close` and `scrollIntoView`.
- Commands: `pnpm --filter web test`, `pnpm --filter web e2e`, `pnpm --filter web typecheck`, `pnpm --filter web lint`.
