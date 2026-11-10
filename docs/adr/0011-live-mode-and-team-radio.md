# 0011. Live mode and team radio

- Status: Accepted (Phase 9, 2026-11-10)

## Context
ADR 0002 settled where live data comes from: the official live timing SignalR feed, without authentication, from a home connection only and for personal use. The public demo is replay-only. Phase 9 turns that into a page: who leads, the gaps, the tyres, the race control messages, the team radio, and the one strategy answer a fan asks during a race: "where would my driver rejoin if he pitted now?".

## Decision
- **One local process.** `manage.py live` (`make live`, compose profile `live`, never started by `make up`) runs the `racedata.live` client, merges the feed into a session state and builds a snapshot (`racedata.live.snapshot.view`). `stintline.live.publisher.Publisher` adds the strategy fields and publishes at most once per second: the latest snapshot goes to the Redis cache (expires after 120 s, so a stopped process reads as offline) and to the `live` Channels group.
- **Nothing is written to Postgres during a session.** The usual import (`refresh_recent`, OpenF1 and Jolpica) stores the race once it is finished. The live view only borrows from stored races at the same circuit: the circuit outline and the pit loss of the latest stored race there (`stintline.live.circuit`).
- **Delivery.** `GET /api/v1/live` returns `offline | waiting | live | finished`, the latest snapshot and the next scheduled session. The WebSocket `/ws/live` sends the latest snapshot on connect, then every new one. The web page polls the status every 30 s and opens the socket only while a session is on; it reconnects with back-off.
- **TV delay.** The browser keeps the snapshots it received and shows the one from N seconds ago (0, 5, 10, 30, 60 s), remembered per viewer. The server never delays anything.
- **Cars on the circuit.** Positions come from timing (laps and mini-sector progress), not from `Position.z`, which needs authentication. Between updates, cars are moved forward by at most 6 % of a lap at their last lap pace.
- **Pit now.** `stintline.live.strategy.pit_now` applies the pit-exit reasoning to live gaps: a car stopping now loses the circuit's green-flag pit loss and rejoins behind every running car with a smaller gap. Lapped cars count one leader lap per lap down. The ghost on the map shows where the car would be, with the pit-loss spread.
- **Team radio.** Clips are links to the official static files, played by the browser (`<audio preload="none">`). They are never downloaded, stored or re-hosted.
- **Recordings.** `--record DIR` writes the raw feed as JSON lines in `./recordings` (git-ignored, personal use). `--replay FILE --speed N` plays one back. `manage.py live_demo --session ID --out FILE` rebuilds a recording from a stored race, with no official data, so the live mode can be tried and demoed at any time.

## Consequences
- The page works only on the machine that runs `make live`; elsewhere it explains how to start it and names the next session. This matches ADR 0002 and costs nothing.
- Without a stored race at the circuit there is no map and no pit answer; the page says so.
- Pit now ignores tyre pace after the stop and safety-car pit losses. The full models stay on the race page once the race is imported.
- Live laps are not persisted, so a session missed by the importer cannot be rebuilt from the live process. `refresh_recent` covers that.
