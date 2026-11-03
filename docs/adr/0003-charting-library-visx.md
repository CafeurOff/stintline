# 0003. Charting library: visx

- Status: Accepted
- Date: 2026-11-03

## Context
The core screens are custom strategy visualisations, not generic dashboards:
- a **stint timeline** per driver (a Gantt-like chart with compound-coloured bars, pit markers and SC/VSC/red-flag bands across all rows);
- **degradation charts** (fuel-corrected lap scatter, fitted curve and a confidence band, two drivers overlaid);
- a **simulator** whose chart reacts to a slider in real time.

Accessibility (keyboard focus on marks, text alternatives, AA contrast) and responsiveness are requirements.

## Decision drivers
- Fine control over SVG geometry and layering (bands under bars, annotations).
- Accessibility control at the mark level.
- Typed APIs that fit TypeScript strict mode.
- Bundle size and render performance with ~20 drivers × ~70 laps.

## Options considered
### Recharts
- Pros: Fast to build standard charts, declarative, `accessibilityLayer`, widely known. Used in v1.
- Cons: A Gantt-style stint timeline and spanning SC bands need workarounds (stacked bars, custom shapes). Custom marks are hard to make focusable. Opinionated layout fights bespoke annotation.

### visx (chosen)
- Pros: Low-level primitives (scales, shapes, axes, groups) on top of React and d3. Full control of SVG and ARIA per mark. Modular imports keep the bundle small. Good TypeScript types.
- Cons: More code per chart (axes, tooltips, legends assembled by hand). Fewer ready-made interactions.

### Plain d3
- Pros: Maximum control.
- Cons: Imperative DOM work that conflicts with React rendering. More code than visx for the same result.

## Decision
Use **visx** (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/group`, plus `@visx/tooltip`, `@visx/responsive` and others as needed). Shared chart building blocks live in `apps/web/src/components/charts/`, with a consistent palette, accessible tooltip, and a table fallback.

## Consequences
- Positive: Strategy visuals look and behave exactly as designed, with accessibility built in.
- Negative: More code to write and test. This is mitigated by shared chart primitives and Vitest tests on scale and geometry helpers.
- Follow-ups: Define compound colours plus letter labels (S/M/H/I/W) and team-colour handling in one theme module, with AA contrast tests.
