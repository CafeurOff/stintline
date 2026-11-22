# 0030. Live timing on the public site, through a relay

- Status: Accepted (the maintainer chose to serve the live page publicly on 2026-11-22)
- Date: 2026-11-22
- Supersedes: the "local only" parts of [0002](0002-data-sources-and-live-strategy.md) and [0011](0011-live-mode-and-team-radio.md)

## Context
ADR 0002 and 0011 kept the live mode on the maintainer's own machine: the formula1.com terms
restrict live timing to personal, non-commercial use, and cloud addresses were reported as
blocked. In production the live timing domain does answer 403 to the server, for the hub as
well as for the team radio clips (ADR 0029). The maintainer decided to serve the live page
publicly anyway, knowing that this departs from those terms and that F1 may block it.

## Decision
- **Relay.** A small relay on another network serves the same paths as
  `livetiming.formula1.com` (`/signalrcore/negotiate`, the `/signalrcore` WebSocket and the
  team radio MP3s) and nothing else, behind a bearer token. `RADIO_RELAY_URL` /
  `RADIO_RELAY_TOKEN` configure it for the clips and the live connection alike; without them
  the client goes to the official hub directly, as before.
- **Live process on the server.** `stintline-live.service` runs `manage.py live` on the primary
  server only (vps-infra `SCHEDULED_UNITS`). It reconnects by itself and publishes as described
  in ADR 0011; the radio thread transcribes new clips (ADR 0029).
- **Delivery.** nginx proxies `/ws/live` (WebSocket, a few connections per address) to the API;
  every other `/ws/` path stays closed.

## Consequences
- The live page works for every visitor while a session runs.
- If F1 blocks the relay too, the page reads as offline, the importer still stores each session
  after it ends, and the clips stay pending. Removing `RADIO_RELAY_URL` stops both uses.
- Live data is still never written to Postgres during a session (ADR 0011).
- The process holds about 800 MB while the radio thread has Whisper loaded.
