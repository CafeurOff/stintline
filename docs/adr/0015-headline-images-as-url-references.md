# 0015. Headline images as URL references

- Status: Accepted (maintainer decision, 2026-11-12). Amends ADR 0012.
- Date: 2026-11-12

## Context
ADR 0012 kept only the title, link, date and language of feed items, and dropped images. The maintainer reviewed the news on a competitor's site (a list of headlines with a picture for each) and asked for headlines with images on StintLine. Two of our four feeds (Autosport, Motorsport.com France) attach a picture to each item through an RSS `enclosure`; RaceFans and F1i only embed pictures inside the article body, which we never read.

## Decision drivers
- News that looks alive on the home and news pages.
- Publishers' content stays theirs: no stored text, no re-hosted media (ADR 0012, same spirit as ADR 0006).
- Zero budget, no extra requests to publishers' sites.

## Options considered
### Keep headlines without pictures
- Pros: nothing to change. Cons: the maintainer rejected it; news lists look bare.

### Download and serve the pictures ourselves
- Pros: under our control, no third-party request from the browser. Cons: re-hosting someone else's photos; storage. Rejected.

### Fetch each article page for its `og:image`
- Pros: a picture for every feed. Cons: one extra request per article to the publisher, scraping. Rejected.

### **Keep the picture URL the feed itself provides, shown as a reference**
- Pros: the publisher chose to syndicate that picture with the item; no download, no extra request on our side. Cons: only feeds with enclosures get pictures; the browser loads images from publishers' CDNs.

## Decision
`racedata.providers.feeds` keeps the HTTPS URL of the item's image (RSS `enclosure` or Media RSS `content`/`thumbnail` of an image type) as `Headline.image_url`. The API returns it on `/news/headlines` unless `NEWS_IMAGES_ENABLED` is off. The web shows it with `referrerPolicy="no-referrer"`, always next to the source name and linked to the publisher's article, and falls back to an original illustration (source initials and colour) when there is no picture or it fails to load. Images are never downloaded, cached or committed. Recorded feed fixtures keep image references (URLs only), never summaries or bodies.

## Consequences
- Positive: richer news lists at no cost; one switch turns pictures off everywhere.
- Negative / risks: a publisher may object or change its feed; the switch and the fallback cover both. Third-party image requests reveal a visitor's IP to the publisher's CDN, like any embedded image.
- Follow-ups: none planned for feeds without enclosures (no scraping).
