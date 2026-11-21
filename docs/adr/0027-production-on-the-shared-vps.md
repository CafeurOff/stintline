# 0027. Production on the shared VPS (vps-infra), without Docker

- Status: Accepted (maintainer chose the native integration on 2026-11-21)
- Date: 2026-11-21

## Context
The public replay-only site (ADR 0002) goes to production at `stintline.omexis.fr` on the
maintainer's existing server. That server is run by a separate repository, vps-infra: every app
runs as systemd units under its own Unix user, on one shared PostgreSQL 17 and Redis, behind
the host's nginx with Let's Encrypt certificates, with Prometheus/Grafana/Alertmanager
(Discord) and daily restic backups off the server. Docker is not installed there. The Compose
demo stack (`infra/docker-compose.demo.yml`) brings its own PostgreSQL, Redis and nginx.

## Decision drivers
- Same supervision, backups, release and rollback as the other apps on the server.
- No second database server, no container runtime on a production host, zero budget.
- No change to how the app runs: same settings (`config.settings.prod`), same routing.

## Options considered
### Docker Compose demo stack behind the host's nginx
- Pros: already written and tested; identical to `make demo-up`.
- Cons: a Docker daemon and its firewall rules on the production host; a second PostgreSQL
  and Redis; outside the server's dashboards (processes grouped by Unix user, journald logs),
  backups and release tooling, so each would need a parallel version.

### vps-infra app (chosen)
- Pros: every server feature applies as is: per-app dashboards, probes and Discord alerts,
  restic backups with a tested restore, releases by tag with health check and automatic
  rollback, `vps` toolkit, systemd sandboxing.
- Cons: a second way to run production besides the Compose stack; the release is built on
  the server (Node 22 pinned by checksum, since Debian ships Node 20).

## Decision
- `deploy/vps/` describes the app for vps-infra: manifest (`app.env`), `build.sh` (uv venv,
  web build, static files; no secrets), `release.sh` (deploy checks, migrations), three units
  (`stintline-web` uvicorn on 127.0.0.1:8020, `stintline-worker`, `stintline-beat` which only
  runs on the primary server), the nginx site, Prometheus scrape job, probes, alerts and key
  numbers. No `live` unit: live timing stays local (ADR 0002).
- nginx serves the built files from the release and sends everything else to the API, as the
  demo image's nginx does; it sends the security headers and HSTS once, hiding Django's copies.
- `/metrics` (django-prometheus plus data coverage gauges, `stintline/core/metrics.py`) only
  answers loopback; nginx returns 404 for it too.

## Consequences
- Releases are tags (`vX.Y.Z`): `vps deploy stintline <tag>` on the server.
- The Compose demo stack stays for local and other hosts; both must keep working when the
  build changes (new system dependency, new environment variable).
- Runbook: `docs/deploy.md`, section « Production on stintline.omexis.fr ».
