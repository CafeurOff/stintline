# Contributing to StintLine

Thanks for your interest. Bug reports, data corrections, model ideas and code are all welcome.

## Set up

Prerequisites: [uv](https://docs.astral.sh/uv/) ≥ 0.9, Node ≥ 22.12 with pnpm 10, Docker with Compose v2, and `pre-commit` (`uv tool install pre-commit`).

```bash
make setup       # Python and JS dependencies, Playwright Chromium, git hooks, .env
make up          # the whole stack: http://localhost:5173
make seed        # three 2025 races from recorded fixtures, no network
```

To work on one side only: `make deps` starts Postgres and Redis, then `make dev-api` and `make dev-web` run the API and the web app with reload.

[`CLAUDE.md`](CLAUDE.md) is the reference for the architecture, every command, the conventions and the known pitfalls of the data. Read it before a first change; [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) and [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) add the rules of each app.

## Conventions

- Code, comments, docs and commit messages in English. The interface is in English and French: every visible string goes through the dictionaries in `apps/web/src/lib/i18n/`.
- Python: ruff (lint and format) and mypy strict. TypeScript: strict mode, no `any`, ESLint and Prettier.
- Comments say why, not what: a provider limit, a data quirk, a non-obvious choice.
- Every modelling assumption is a named parameter with a documented default (`docs/model.md`). Never tune on the held-out backtest races.
- The web app calls the API only through the client typed from the OpenAPI schema. After an API change, run `make types` and commit the schema and `packages/api-types`.

## Tests

```bash
make test-fast   # every unit test, no coverage, about 20 s
make check       # lint, type checks, tests with coverage gates, schema drift: about a minute
make e2e         # Playwright journeys against a mocked API
```

- No network in tests. Upstream responses are recorded fixtures under `packages/racedata/fixtures/`; record a new one with `uv run python -m racedata.tools.record_fixture <provider> <path> [params]`.
- Coverage gates: `packages/strategy` ≥ 90 %, `packages/racedata` ≥ 85 %, `apps/api` ≥ 80 %, `apps/web` ≥ 80 %.
- API tests that need race data use the `seeded` fixture rather than importing it themselves.

## Architecture decisions

A significant choice (a new dependency, data source, modelling approach or piece of infrastructure) gets a short ADR in [`docs/adr/`](docs/adr): copy `0000-template.md` with the next number. ADRs are dated decisions; a later ADR amends an earlier one instead of rewriting it.

## Pull requests

1. For anything beyond a small fix, open an issue first and agree on the approach.
2. Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
3. Keep commits small and use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `ci:`, `build:`, `perf:`). The `commit-msg` hook checks the format.
4. Run `make check` before pushing, then open the pull request with the template. CI must pass, and a maintainer reviews against the checklist.

## Data and trademarks

- Use only the sources listed in [`docs/data-sources.md`](docs/data-sources.md), within their terms. Never commit live-timing recordings.
- No team logos, no "F1" in product naming. Official driver portraits and car renders are linked from their URLs, never downloaded or committed.
- Never commit secrets: use `.env` (ignored) and document new variables in `.env.example`. gitleaks runs on every commit and in CI.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Report unacceptable behaviour as described there.
