# Contributing to StintLine

Thanks for your interest. StintLine is a portfolio-grade project, so the bar is "would a team's engineering-tools group merge this?".

## Getting started
Prerequisites: [uv](https://docs.astral.sh/uv/) ≥ 0.9, Node ≥ 22.12 + pnpm 10, Docker with Compose v2, and `pre-commit` (`uv tool install pre-commit`).

```bash
make setup     # Python + JS dependencies, git hooks
make up        # full stack with demo data: http://localhost:5173
make check     # lint + type checks + tests, back and front
```

`CLAUDE.md` is the single source of truth for architecture, commands, conventions and known pitfalls. Read it before your first change.

## Workflow
1. Open or pick an issue. For anything non-trivial, agree on the approach in the issue first.
2. Branch from `main`: `feat/<short-topic>`, `fix/<short-topic>`, `docs/<short-topic>`.
3. Keep commits small and use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `ci:`, `build:`, `perf:`. Write in English, imperative mood. The `commit-msg` hook enforces the format.
4. Commit only when `make check` passes.
5. Open a PR using the template. CI must be green, and the reviewer checks the Definition of Done.

## Definition of Done
- Lint, strict typing and tests pass locally and in CI.
- Coverage: `packages/strategy` ≥ 90 %, `packages/racedata` ≥ 85 %, `apps/api` ≥ 80 %.
- No network access in tests: upstream data comes from recorded fixtures.
- OpenAPI schema and generated TypeScript types are up to date (`make types`).
- Docs, `CLAUDE.md` and ADRs are updated where relevant.
- `make up` still starts everything.

## Architecture decisions
Significant choices (new dependency, new data source, modelling approach, infrastructure) get a short ADR in `docs/adr/` (copy `0000-template.md`, next number).

## Data and trademarks
- Only use data sources listed in `docs/data-sources.md`, and respect their terms. Never commit live-timing recordings beyond the trimmed fixtures documented there.
- Do not add team logos, official imagery, driver photos or the "F1" mark in product naming. Team colours are fine.
- Never commit secrets: use `.env` (ignored) and document variables in `.env.example`. `gitleaks` runs on every commit.

## Code of conduct
Be respectful and constructive. Harassment of any kind is not tolerated.
