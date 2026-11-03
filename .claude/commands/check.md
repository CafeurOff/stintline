---
description: Run lint, type checks and tests for backend and frontend, then summarise failures
allowed-tools: Bash(make check), Bash(uv run ruff *), Bash(uv run mypy*), Bash(uv run pytest*), Bash(pnpm -r *), Bash(pnpm --filter *), Bash(git status*), Bash(git diff*)
---

Run the full quality gate and report results. Do not fix anything unless I ask.

Run each step even if a previous one fails, so the report is complete:

1. `uv run ruff check .` and `uv run ruff format --check .`
2. `uv run mypy`
3. `uv run pytest packages/strategy packages/racedata apps/api -q --cov --cov-report=term-missing:skip-covered`
4. `pnpm -r lint` and `pnpm -r format:check`
5. `pnpm -r typecheck`
6. `pnpm --filter web test -- --run`
7. `pnpm --filter api-types check` (generated types match `apps/api/openapi.yaml`)

If a tool or directory does not exist yet (scaffolding not created), mark the step `SKIPPED (not set up)` instead of failing.

Report as a table: step | status (PASS/FAIL/SKIPPED) | error count | duration.
Then, for each FAIL, list at most 10 errors as `path:line` with the message, grouped by file, and one line on the likely cause.
Finish with the coverage figures versus the gates in `CLAUDE.md` (strategy ≥ 90 %, racedata ≥ 85 %, api ≥ 80 %).
