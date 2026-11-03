# 0006. Official driver and car images as URL references

- Status: Accepted (maintainer decision, 2026-11-03)
- Supersedes the "no official imagery" rule of the original brief, for driver portraits and car renders only

## Context
The maintainer wants the latest driver portraits and car images in the UI. These are copyrighted Formula 1 assets. Free alternatives were proposed (Wikimedia Commons photos with attribution, or original illustrations) and declined.

## Decision
- The API returns **URLs** to `media.formula1.com` built from the season, the team display name and the driver media id taken from OpenF1 `headshot_url`. Nothing is downloaded, stored, committed or proxied.
- `OFFICIAL_MEDIA_ENABLED` (default `true`) switches every reference off at once. The UI then shows original illustrations (team-colour car silhouette, numbered avatar). It also falls back to these when an image fails to load.
- Team logos stay excluded. The README keeps the non-affiliation notice.

## Consequences
- Risk: use of protected assets in a public portfolio. Mitigation: no redistribution, a one-variable kill switch, takedown handled by setting it to `false`.
- External dependency on an undocumented CDN path, which may change. Broken images degrade to illustrations.
