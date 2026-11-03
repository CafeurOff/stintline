---
description: Scaffold a versioned DRF endpoint with serializer, tests and OpenAPI/TS type regeneration
argument-hint: <app> <resource-name> [GET|POST] [short description]
---

Create a new endpoint: $ARGUMENTS

Follow `apps/api/CLAUDE.md`. Steps:

1. **Clarify first.** If the resource shape, query parameters, pagination or caching are not obvious from the arguments, ask before writing code.
2. **Serializer** in `apps/api/stintline/<app>/api/serializers.py`. Use explicit fields, never `__all__`, read-only where possible, and typed `SerializerMethodField` results via `@extend_schema_field`.
3. **Business logic** in `services/` (writes, computations) or `selectors.py` (reads). Use `select_related` / `prefetch_related` to avoid N+1.
4. **View** in `api/views.py`. Keep it thin: `@extend_schema` with summary, parameters, responses (including the problem format for 400/404). Use the pagination class. Send `Cache-Control` and `ETag` for historical data.
5. **Route** in `api/urls.py` under `/api/v1/`.
6. **Tests** in `apps/api/stintline/<app>/tests/test_api_<resource>.py`, built with factory_boy factories and no network:
   - happy path (status, payload shape, ordering)
   - validation error and not-found
   - pagination and the cache headers if applicable
   - a query-count assertion (`django_assert_max_num_queries`)
7. **Contract.** Run `make types`, which regenerates `apps/api/openapi.yaml` and `packages/api-types`. Then check the diff is limited to the new endpoint.
8. Run `uv run pytest apps/api/stintline/<app>` and `uv run mypy`, then summarise the files changed.
