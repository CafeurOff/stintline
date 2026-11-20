# Deploying the public demo

The public demo is **replay-only** (ADR 0002). The official live timing feed only answers home connections and is for personal use, so a server never runs the `live` service. The live page then says no session is running, shows the next one and links to the last race replay.

## What runs

`infra/docker-compose.demo.yml` builds the production images, the same `prod` targets as CI:

| Service | Image | Role |
| --- | --- | --- |
| `web` | `stintline-web:prod` (nginx) | Serves the built files (gzip, a year of cache for `/assets/`), proxies `/api/` and `/ws/`, and sends every page to the API, which renders it with its head (ADR 0025). Security headers for every response. The only published port (`DEMO_PORT`, default 8080). |
| `migrate` | `stintline-api:prod` | Applies migrations, then exits. The API starts after it. |
| `api` | `stintline-api:prod` (uvicorn, 2 workers) | `/api/v1`, the pages with their head, `sitemap.xml` and `robots.txt`, production settings (`config.settings.prod`). Built with the web image as a build context, so it renders the same index.html nginx serves. |
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

Set `SITE_URL=https://<host>` in `infra/demo.env`: canonical addresses, language alternates, link previews and the sitemap use it. Without it they follow the request's host.

The API reaches out to three hosts only: the data providers on its schedule, fia.com for a PDF a reader opens (ADR 0018) and Wikimedia's image hosts for a portrait not yet in the cache (ADR 0024). Pages load nothing from Wikimedia themselves.

Every page carries a Content-Security-Policy from the API (own scripts, plus the inline ones by hash; pictures from any HTTPS host because official media and news pictures are URL references). nginx adds `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and `Cross-Origin-Opener-Policy` to every response (`infra/nginx/security-headers.conf`; a `location` with its own `add_header` must include it again, or nginx drops them). HSTS comes from Django behind HTTPS.

nginx in `web` listens on plain HTTP. Put a TLS reverse proxy in front of it (Caddy, Traefik, or a tunnel such as Cloudflare Tunnel) and forward to `DEMO_PORT`. The API trusts `X-Forwarded-Proto` to know the request was HTTPS. WebSockets (`/ws/`) are only used by the live mode, so the demo does not need them.

Any machine with Docker works. The stack is light: under 1 GB of RAM in use with every season since 1950 loaded (about 770 MB measured).

## Media

`OFFICIAL_MEDIA_ENABLED=true` is the default (ADR 0014): drivers show their latest official portrait and teams their car render, only ever linked from their original URLs and never stored (ADR 0006). Set it to `false` to fall back at once to Wikipedia portraits with their credit (ADR 0009) and the original numbered avatars and team-colour illustrations.

## Audience

No tracker and no cookie on the site. Visits are counted from nginx's access log, which the official image writes to standard output in the combined format, with [GoAccess](https://goaccess.io/):

```bash
docker compose -f infra/docker-compose.demo.yml --env-file infra/demo.env logs web --no-log-prefix --since 720h \
  | goaccess - --log-format=COMBINED --ignore-crawlers -o report.html
```

Behind a TLS proxy the client address is the proxy's: let nginx read the real one from `X-Forwarded-For` (`set_real_ip_from <proxy address>; real_ip_header X-Forwarded-For;`) for unique-visitor counts. Docker's default log driver keeps the log until the container is recreated; mount a volume on `/var/log/nginx` with a file `access_log` to keep longer history.

## Updating

```bash
git pull
make demo-up        # rebuilds the images; migrations run before the API starts
```

The database lives in the `demo-postgres` volume. `make demo-down` keeps it.
