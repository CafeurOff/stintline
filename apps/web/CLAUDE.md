# apps/web — frontend conventions

Read the root `CLAUDE.md` first. This file only adds frontend-specific rules.

## Layout
- `src/app/`: router, providers (QueryClient, theme), layout shell.
- `src/features/<feature>/`: `components/`, `hooks/`, `api.ts` (TanStack Query hooks), `types.ts`, `*.test.tsx`. Features: `session-picker`, `race-strategy`, `degradation`, `simulator`, `model-about`, `live`.
- `src/components/ui/`: accessible primitives (Button, Select, Slider, Tabs, Tooltip, Skeleton, ErrorState).
- `src/lib/`: API client (typed from `@stintline/api-types`), formatting (lap times, deltas), team colours.

## Rules
- TypeScript strict, no `any`, no non-null assertions to silence errors. API types come only from `@stintline/api-types`. Never redeclare them.
- Server state lives in TanStack Query only, with no copy in `useState`. URL state (season, event, session, drivers, lap) goes in search params so views can be shared.
- Every data view has explicit loading (skeleton), empty and error (retry) states.
- Accessibility: keyboard reachable controls, visible focus, labelled inputs (the simulator slider has `aria-valuetext`), WCAG AA contrast in light and dark, colour never the only signal (compounds show letter + colour).
- Charts use the library chosen in its ADR. Each chart has a text summary or table alternative.
- No logos, official imagery or driver photos. Team colours only, from API data.
- UI copy in English.

## Tests
- Vitest + Testing Library: test behaviour through roles and labels, not implementation. MSW handlers built from the generated types, with no network.
- Playwright: session picker → strategy view, simulator slider update, model page.
- Commands: `pnpm --filter web test`, `pnpm --filter web e2e`, `pnpm --filter web typecheck`, `pnpm --filter web lint`.
