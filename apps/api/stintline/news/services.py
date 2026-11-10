"""Store feed headlines: upsert by link, drop the old ones."""

from __future__ import annotations

from datetime import datetime, timedelta

import structlog
from django.db import transaction

from racedata.config import FEEDS
from racedata.models import Headline as HeadlineDTO
from racedata.sources import Sources
from stintline.news.models import Headline

log = structlog.get_logger(__name__)

RETENTION = timedelta(days=30)
"""Headlines older than this are deleted: the page shows the news, not an archive."""
SOURCE_NAMES = {feed.key: feed.name for feed in FEEDS}


@transaction.atomic
def store_headlines(items: list[HeadlineDTO], now: datetime) -> int:
    """Upsert ``items`` by URL and delete headlines past ``RETENTION``. Returns the number
    of new headlines."""
    known = set(
        Headline.objects.filter(url__in=[h.url for h in items]).values_list("url", flat=True)
    )
    for item in items:
        Headline.objects.update_or_create(
            url=item.url,
            defaults={
                "source": item.source,
                "language": item.language,
                "title": item.title,
                "published_at": item.published_at,
                "fetched_at": now,
            },
        )
    Headline.objects.filter(published_at__lt=now - RETENTION).delete()
    return len({h.url for h in items} - known)


def refresh_headlines(sources: Sources, now: datetime) -> int:
    if sources.news is None:
        return 0
    per_feed = sources.news.headlines()
    items = [item for feed in per_feed.values() for item in feed]
    created = store_headlines(items, now)
    log.info("headlines_refreshed", feeds=len(per_feed), items=len(items), created=created)
    return created
