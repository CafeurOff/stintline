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

## Production on stintline.omexis.fr

The public instance does not use the Compose stack: it runs as an app of the maintainer's
server, managed by the separate vps-infra repository (ADR 0027). `deploy/vps/` describes it.

| Piece | Where |
| --- | --- |
| API and pages | `stintline-web.service`: uvicorn, 2 workers, `127.0.0.1:8020` |
| Imports | `stintline-worker.service` (Celery, one process, default queue) and `stintline-beat.service` (primary server only) |
| Team radio transcripts | `stintline-radio.service` (Celery, `radio` queue, one fresh process per task, ADR 0029) |
| Built files | nginx serves `apps/web/dist` of the current release; everything else goes to the API |
| Database | `stintline` on the server's PostgreSQL 17 (socket, peer authentication: no password) |
| Redis | database 6 of the server's Redis, ACL user `stintline` (`REDIS_URL`) |
| Generated settings | `/etc/stintline/vps.env` (`DATABASE_URL`, `REDIS_URL`), written by vps-infra |
| Secrets and settings | `/etc/stintline/stintline.env`: `DJANGO_SECRET_KEY` (generated on the server), `DJANGO_ALLOWED_HOSTS` (the host name, plus `127.0.0.1,localhost` for the health check and the Prometheus scrape), `DJANGO_CSRF_TRUSTED_ORIGINS`, `SITE_URL`. `vps secrets edit stintline` |
| Releases | `/opt/stintline/releases/<tag>`, `current` and `previous` (read-only for the app) |
| Data | `/var/lib/stintline` (provider cache, beat schedule) |

### Releasing

Push a tag: `git tag -a v1.2.3 -m "..." && git push origin v1.2.3`. The **Deploy Production**
workflow runs the whole CI on that commit, then asks the server to deploy it over SSH (a key
that can only run `deploy`, `build`, `rollback`, `status` and `releases` for this app). On the
server the release is built as `deploy` (`deploy/vps/build.sh`: uv, Node 22 pinned by
checksum, pnpm, collectstatic), `deploy/vps/release.sh` runs `check --deploy` and the
migrations while beat is stopped, then the switch and a health check on `/api/v1/health`. An
unhealthy release is rolled back by the server; a failed public check afterwards (health with
the new version, home page, sitemap, robots, `/metrics` closed) rolls back from the workflow.

Only maintainers can push `v*` tags (repository ruleset); the deploy key lives in the
`production` environment, which only accepts `v*.*.*` tags. By hand on the server:
`vps deploy stintline v1.2.3`, `vps rollback stintline`,
`vps releases stintline`. Migrations are never reverted: keep them compatible with the
previous release. `/api/v1/health` reports the tag of the running release (the `VERSION`
file vps-infra writes at the release root).

### Supervision

Grafana (vps-infra) shows StintLine with the other apps: status, version, traffic and slowest
views, CPU and memory, database size, backups, logs, and its key numbers (seasons, races with
replays, age of the last import, races overdue). Alerts go to Discord: API down, probe on
`https://stintline.omexis.fr/api/v1/health`, worker or beat stopped, a race not imported 12 h
after it ended, headlines not refreshed for 6 h. `vps status`, `vps kpi stintline`,
`vps logs stintline`.

Those probes run on the server itself. The **Uptime** workflow checks the health endpoint
and the home page from GitHub's network every 15 minutes; a failed run e-mails the
repository owner, so the server being down or unreachable is reported too.

### Backups and restore

`vps-backup@stintline.timer` dumps the database (`pg_dump -Fc`) with `/var/lib/stintline` and
`/etc/stintline` every night, encrypted, to S3 with restic (14 daily, 8 weekly, 12 monthly
snapshots). A monthly test restores the latest dump into a scratch database and compares it.

```bash
vps backup list app:stintline                       # snapshots
vps backup now stintline                            # one now
vps backup restore-db stintline stintline_restore   # latest dump into a NEW database
# check it (vps db shell stintline_restore), then to replace the live data:
vps maintenance on stintline
sudo systemctl stop stintline-web stintline-worker stintline-beat
sudo -u postgres psql -c 'ALTER DATABASE stintline RENAME TO stintline_old' \
                      -c 'ALTER DATABASE stintline_restore RENAME TO stintline'
sudo -u postgres psql -c 'ALTER DATABASE stintline OWNER TO stintline'
vps restart stintline && vps maintenance off stintline
# once the site is checked: sudo -u postgres dropdb stintline_old
```

### Loading a database copied from another machine

```bash
pg_dump -Fc -U stintline stintline > stintline.dump        # on the source machine
scp stintline.dump <server>:/tmp/
# on the server (the API keeps serving; worker and beat must not write meanwhile)
sudo systemctl stop stintline-worker stintline-beat
sudo chown stintline /tmp/stintline.dump
sudo -u stintline pg_restore --clean --if-exists --no-owner --no-privileges \
     -d stintline /tmp/stintline.dump
vps restart stintline && rm /tmp/stintline.dump
```
