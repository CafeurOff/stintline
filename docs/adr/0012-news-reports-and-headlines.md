# 0012. News: race reports from our data, headlines linked to their sources

- Status: Accepted (Phase 10, 2026-11-11). Images amended by ADR 0015.

## Context
The roadmap (ADR 0008) ends the fan hub with a news page. Two things were agreed on 2026-11-03: no republished articles (they belong to their publishers), and no paid service (zero budget, so no hosted language model). The page still has to feel alive after every Grand Prix and between them.

## Decision
- **Race reports written from our data.** `stintline.news.reports.build` collects the facts of each classified race and sprint: winner, margin and podium (gap in seconds or laps), starting position, career Grand Prix wins, the winner's stops and tyres, safety cars, virtual safety cars and red flags, rain, biggest climb from the grid, fastest lap, retirements, and the championship after the round (leader, lead, whether it changed hands). The API returns facts, not prose (`GET /news/reports`, `GET /news/reports/{session_id}`). The web writes the sentences from the EN and FR dictionaries (`features/news/write.ts`), so both languages read naturally and nothing is invented beyond the data.
- **A fact is stated only when its data is there.** Safety cars only when race control was imported (a missing feed must not read as "no safety car"); strategy only with stints; rain only with weather samples; championship only for races with standings. Results imported from Jolpica have no team colour: the report borrows the team's timing colour from the same season, else the latest one.
- **Headlines, linked.** `racedata.providers.feeds` reads public RSS 2.0 and Atom feeds (`racedata.config.FEEDS`: Autosport, RaceFans and F1i in English, Motorsport.com France in French, checked on 2026-11-11). Only the title, link (without `utm_*` tracking), date and language are kept; summaries, article bodies and images are dropped while parsing. Links open the publisher's site. XML is parsed with `defusedxml`. Each feed is read on its own, so one failing never blocks the rest.
- **Freshness.** Celery beat runs `refresh_headlines` every 30 minutes, and each worker queues it on start (like `refresh_recent`). Headlines older than 30 days are deleted. `manage.py refresh_news` reads the feeds on demand. Reports need no job: they follow the race imports, cached until results or timing change.
- **Fixtures** keep 12 items per feed reduced to their headline fields (`record_fixture feeds <key>`); a test checks they hold no article text.

## Consequences
- Every report is accurate by construction and costs nothing, but it reads as a factual summary, not journalism: no quotes, no context beyond the data.
- Feeds can change address or format at any time. A broken feed only logs `feed_unavailable`; the source list is one tuple to edit.
- French headlines come from a single publisher for now (other French feeds were unreachable or blocked automated readers when checked).
- A hosted language model could later turn the same facts into richer prose; the facts API would not change.
