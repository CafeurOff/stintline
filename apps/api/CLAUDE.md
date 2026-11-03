# apps/api — backend conventions

Read the root `CLAUDE.md` first. This file only adds backend-specific rules.

## Layout
- `config/`: `settings/{base,dev,test,prod}.py` (env-driven via `django-environ`, no default secrets), `urls.py`, `asgi.py`, `celery.py`.
- `stintline/<app>/`: `models.py`, `services/` (business logic, plain functions), `selectors.py` (read queries), `api/` (`serializers.py`, `views.py`, `urls.py`), `tasks.py`, `tests/`.
- Views stay thin: validate with a serializer, call a service or selector, serialize. No ORM queries or strategy maths in views.

## API
- Everything is under `/api/v1/`. Routers and `@extend_schema` on every view, so drf-spectacular produces a complete schema.
- Pagination is on by default (cursor or limit/offset per resource). Historical resources send `Cache-Control` and `ETag`.
- Errors use one problem format (`type`, `title`, `status`, `detail`, `code`). Upstream errors never leak.
- After any serializer or view change, run `make types` and commit `apps/api/openapi.yaml` plus `packages/api-types`.

## Models and ingestion
- Every ingested model has a natural-key `UniqueConstraint` (e.g. `Lap(session_entry, lap_number)`). Ingestion uses `update_or_create` / `bulk_create(update_conflicts=True)` on that key, so re-running a task never duplicates.
- Celery tasks (`ingest_season`, `ingest_event`, `ingest_session`) are idempotent, retry on `UpstreamUnavailable` with back-off, and log `task_started` / `task_succeeded` with keys.
- Store provider IDs (`openf1_session_key`, `jolpica_round`…) as columns, never as the primary key.

## Tests
- `pytest-django` + factory_boy (`tests/factories.py`). Test settings use Postgres in CI and SQLite only where explicitly allowed.
- Provider calls are replaced by fixture-backed fakes from `racedata` (`tests/fixtures/<provider>/`). An autouse fixture blocks sockets (`pytest-socket`).
- Coverage gate: ≥ 80 %.
