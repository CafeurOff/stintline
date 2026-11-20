# 0024. Wikipedia portraits relayed from our origin

- Status: Accepted (maintainer took the audit's recommendation on 2026-11-20, polish lot 7)
- Date: 2026-11-20
- Amends: [0009](0009-wikipedia-driver-portraits.md)

## Context
ADR 0009 shows Wikipedia portraits as URL references: the browser loads each thumbnail from
upload.wikimedia.org. Wikimedia sets cookies on those responses. On the standings page,
Lighthouse counts them as third-party cookies and the "best practices" score falls to 77–79.
Some browsers block them or warn about them, and every visitor tells Wikimedia which pages
they read.

## Decision drivers
- No third-party request from our pages for a portrait.
- The licence credit (author, licence, file page) stays next to the picture, as in 0009.
- No image stored on disk or in the database; nothing grows without bound.
- Not an open proxy: only the URL stored for a driver can be fetched.

## Options considered
### Relay through the API with a cache (chosen)
- Pros: same origin, no cookies; each thumbnail fetched at most once a week; works for
  every page and every serializer at once (`portrait_url`, `photo_url`, `portrait.image_url`).
- Cons: one more view that reaches upstream (after the FIA PDF relay, ADR 0018); a cold
  cache costs a Wikimedia request on the first view.

### Download the thumbnails at import time
- Cons: stores files we do not need to keep; the licences allow it but 0009 chose not to.

### Keep direct links with `referrerpolicy` / `crossorigin`
- Cons: neither stops Wikimedia's cookies.

## Decision
- `GET /api/v1/drivers/{ref}/portrait` returns the thumbnail of the driver's stored
  portrait (`stintline.racing.portraits`), fetched by `racedata`
  (`WikimediaImageSource.thumbnail`, hosts `upload.wikimedia.org` and `thumb.wikimedia.org`, paths under
  `/wikipedia/`, image types only) and kept in the Django cache (Redis) for a week.
- Serializers return `/api/v1/drivers/{ref}/portrait?v=<hash of the stored URL>`. The
  version changes when the import stores another image, so the response carries
  `Cache-Control: public, max-age=604800`.
- Upstream errors become a 502 problem without detail; the web app falls back to its
  numbered avatar as it already does for a broken image.
- Official portraits (ADR 0006) are unchanged: URL references behind
  `OFFICIAL_MEDIA_ENABLED`.

## Consequences
- The public demo needs outbound HTTPS to Wikimedia's image hosts, as it does for fia.com.
- In fixtures mode (`RACEDATA_MODE=fixtures`) there is no image source: the relay answers
  502 and the UI shows avatars.
- Portraits never touch the disk; a Redis flush only costs refetches.
