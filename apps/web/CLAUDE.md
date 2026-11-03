# apps/web — frontend conventions

Read the root `CLAUDE.md` first. This file only adds frontend-specific rules.

## Layout
- `src/app/`: router, providers (QueryClient), layout shell, theme toggle.
- `src/features/<feature>/`: `components/`, `api.ts` (TanStack Query hooks), helpers, `*.test.tsx`. Features: `home`, `health`, `session-picker`, `race-strategy` (session layout, stint timeline, classification, pit loss), `degradation`, `simulator` (undercut, pit exit), `model-about`; `live` comes in Phase 6.
- Routes: `/`, `/sessions/:sessionId` (strategy), `/sessions/:sessionId/degradation`, `/sessions/:sessionId/simulator`, `/model`.
- `src/components/ui/`: accessible primitives (Button, Card, Select, Slider, SegmentedControl, NavTabs, Skeleton, Stat, ErrorState, EmptyState).
- `src/components/racing/`: `CompoundBadge`, `DriverAvatar`, `CarImage` (official media with original fallbacks).
- `src/lib/`: API client and `unwrap` (problem → `ApiError`), formatting, compounds, team colours, theme, URL-state and sizing hooks.
- `src/test/`: MSW server and handlers, typed fixtures recorded from the demo API (`fixtures/*.ts`, Hungary 2025, trimmed). Playwright reuses them through `e2e/mockApi.ts`.

## Theme
- Tokens live in `src/index.css`: Omexis warm neutrals, soft shadows and system type stack, with the v1 dark pit-wall mood and red accent. Dark is the default; `data-theme="light"` on `<html>` switches. The choice is stored in `localStorage` (`stintline-theme`) and applied before first paint by the inline script in `index.html`.
- Use tokens (`bg-surface`, `text-text-muted`, `text-accent-text`…), never raw colours. `accent` is a fill colour; text uses `accent-text`. Compound fills (`--color-tyre-*`) are shared by both themes and always carry a dark letter.

## Rules
- TypeScript strict, no `any`, no non-null assertions to silence errors. API types come only from `@stintline/api-types`. Never redeclare them.
- Server state lives in TanStack Query only, with no copy in `useState`. URL state (season, event, session, drivers, lap) goes in search params so views can be shared.
- Every data view has explicit loading (skeleton), empty and error (retry) states.
- Accessibility: keyboard reachable controls, visible focus, labelled inputs (the simulator slider has `aria-valuetext`), WCAG AA contrast in light and dark, colour never the only signal (compounds show letter + colour).
- Charts use the library chosen in its ADR. Each chart has a text summary or table alternative.
- No logos. Official driver portraits and car renders are shown only from the URLs the API returns (ADR 0006), with `referrerPolicy="no-referrer"`, and always fall back to original illustrations (numbered avatar, team-colour silhouette) when absent or broken. Never download or bundle them.
- Simulations are queries keyed by their request (not mutations), debounced, with the previous result kept on screen.
- UI copy in English.

## Tests
- Vitest + Testing Library: test behaviour through roles and labels, not implementation. MSW handlers built from the generated types, with no network.
- Playwright: session picker → strategy view, simulator slider update, model page, theme persistence. The API is mocked with `page.route` and official media requests are aborted.
- Commands: `pnpm --filter web test`, `pnpm --filter web e2e`, `pnpm --filter web typecheck`, `pnpm --filter web lint`.
