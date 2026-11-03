# syntax=docker/dockerfile:1.7
# API, Celery worker and beat share this image. Build context: repository root.

FROM python:3.13-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.13.3 /uv /uvx /bin/
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app --home /app app

# Dependency layer: only lock and manifests, so code edits don't bust the cache.
COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml apps/api/
COPY packages/strategy/pyproject.toml packages/strategy/
COPY packages/racedata/pyproject.toml packages/racedata/

FROM base AS dev
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --all-packages --no-install-workspace
COPY packages packages
COPY apps/api apps/api
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --all-packages
WORKDIR /app/apps/api
USER app
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --reload --reload-dir /app/apps/api --reload-dir /app/packages"]

FROM base AS prod
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --package stintline-api --no-dev --no-install-workspace
COPY packages packages
COPY apps/api apps/api
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --package stintline-api --no-dev --no-editable
WORKDIR /app/apps/api
ENV DJANGO_SETTINGS_MODULE=config.settings.prod
RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=sqlite://:memory: python manage.py collectstatic --noinput \
    && chown -R app:app /app/apps/api/staticfiles
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"
CMD ["uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--workers", "2"]
