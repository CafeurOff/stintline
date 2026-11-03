# apps/web — frontend conventions

Read the root `CLAUDE.md` first. This file only adds frontend-specific rules.

## Layout
- `src/app/`: router, layout shell (header with race picker, FR/EN, theme), providers.
- `src/features/<feature>/`: `components/`, `api.ts` (TanStack Query hooks), pure helpers, `*.test.ts(x)`. Features: `race` (circuit map, replay clock and maths, pit-stop and undercut panels), `tyres` (wear per compound, strategies, wear chart), `model-about`, `session-picker` (race list), `home` (redirect to the latest race, not found), `health`; `live` comes in Phase 6.
- Routes: `/` (redirects to the latest race with data), `/sessions/:sessionId` (circuit and simulators), `/sessions/:sessionId/tyres`, `/model`.
- `src/components/ui/`: accessible primitives (Button, Select, Slider, SegmentedControl, Skeleton, ErrorState, EmptyState).
- `src/components/racing/`: `CompoundBadge`, `DriverAvatar` (official portrait with a numbered fallback).
- `src/lib/`: API client and `unwrap`, `i18n/` (dictionaries, provider, translated content), locale-aware `createFormatters`, compounds, team colours, theme, URL-state and sizing hooks.
- `src/test/`: MSW server and handlers, typed fixtures recorded from the demo API (`fixtures/*.ts`, Hungary 2025, trimmed). Playwright reuses them through `e2e/mockApi.ts`.

## Theme
- The circuit is the interface (ADR 0007). Keep screens to one question and one answer; no dashboards, stat tiles, gradients, glows or decorative cards.
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
- No logos. Official driver portraits and car renders are shown only from the URLs the API returns (ADR 0006), with `referrerPolicy="no-referrer"`, and always fall back to original illustrations (numbered avatar, team-colour silhouette) when absent or broken. Never download or bundle them.
- Simulations are queries keyed by their request (not mutations), debounced, with the previous result kept on screen.
- UI copy in English and French (see Language).

## Tests
- Vitest + Testing Library: test behaviour through roles and labels, not implementation. MSW handlers built from the generated types, with no network.
- Playwright: latest race → pit-stop simulation, map selection → undercut, French tyres and model pages, theme persistence. The API is mocked with `page.route` and official media requests are aborted.
- Commands: `pnpm --filter web test`, `pnpm --filter web e2e`, `pnpm --filter web typecheck`, `pnpm --filter web lint`.
