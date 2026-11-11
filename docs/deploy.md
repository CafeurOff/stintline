# Deploying the public demo

The public demo is **replay-only** (ADR 0002). The official live timing feed only answers home connections and is for personal use, so a server never runs the `live` service. The live page then says no session is running, shows the next one and links to the last race replay.

## What runs

`infra/docker-compose.demo.yml` builds the production images, the same `prod` targets as CI:

| Service | Image | Role |
| --- | --- | --- |
| `web` | `stintline-web:prod` (nginx) | Serves the built web app, proxies `/api/` and `/ws/` to the API. The only published port (`DEMO_PORT`, default 8080). |
| `migrate` | `stintline-api:prod` | Applies migrations, then exits. The API starts after it. |
| `api` | `stintline-api:prod` (uvicorn, 2 workers) | `/api/v1`, production settings (`config.settings.prod`). |
| `worker` | `stintline-api:prod` | Celery, one process (rate limits are in-process, ADR 0004). |
| `beat` | `stintline-api:prod` | Schedules `refresh_recent` every 30 min and the news feeds: each Grand Prix is imported after it finishes. |
| `postgres`, `redis` | official images | Not published outside the Compose network. |

## First deployment

```bash
cp infra/demo.env.example infra/demo.env
# Fill in DJANGO_SECRET_KEY and POSTGRES_PASSWORD, set DJANGO_ALLOWED_HOSTS to your host name
# and DJANGO_CSRF_TRUSTED_ORIGINS to https://<host>.
make demo-up
```

`infra/demo.env` is git-ignored. Keep `DJANGO_SECURE_SSL_REDIRECT=true` behind HTTPS. Set it to `false` only to try the stack over plain HTTP on your own machine.

### Data

An empty database fills itself: the worker imports the current season on start and keeps it up to date. History since 1950 (`ingest_history`) and older timed seasons take hours because of the providers' rate limits. Two ways to go faster:

- **Copy a local database** that already holds everything: `make demo-load` dumps the development database (`make up`) and restores it into the demo, then restarts the API and worker. Run it on a machine that has both stacks, or move the dump by hand (`pg_dump -Fc` / `pg_restore --clean`).
- **Import on the server:** `docker compose -f infra/docker-compose.demo.yml --env-file infra/demo.env exec api python manage.py ingest_history`, which can be resumed if interrupted.

## HTTPS and the host

nginx in `web` listens on plain HTTP. Put a TLS reverse proxy in front of it (Caddy, Traefik, or a tunnel such as Cloudflare Tunnel) and forward to `DEMO_PORT`. The API trusts `X-Forwarded-Proto` to know the request was HTTPS. WebSockets (`/ws/`) are only used by the live mode, so the demo does not need them.

Any machine with Docker works. The stack is light: under 1 GB of RAM in use with every season since 1950 loaded (about 770 MB measured).

## Media

`OFFICIAL_MEDIA_ENABLED=true` is the default (maintainer decision, ADR 0014): drivers show their latest official portrait and teams their car render, only ever linked from their original URLs and never stored (ADR 0006). Set it to `false` to fall back at once to Wikipedia portraits with their credit (ADR 0009) and the original numbered avatars and team-colour illustrations.

## Updating

```bash
git pull
make demo-up        # rebuilds the images; migrations run before the API starts
```

The database lives in the `demo-postgres` volume. `make demo-down` keeps it.
