"""Driver portraits from Wikipedia (ADR 0009): freely licensed lead images, as references.

Official portraits (ADR 0006) take precedence in the UI. These cover every other driver,
which matters for drivers who raced before 2023.
"""

from __future__ import annotations

import structlog
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from racedata.providers.wikipedia import article_title
from racedata.sources import Sources
from stintline.ingestion.services import IngestReport
from stintline.racing.models import Driver, DriverPortrait

log = structlog.get_logger(__name__)


class PortraitsUnavailableError(RuntimeError):
    """The sources were built without a portrait (Wikipedia) source."""


def ingest_portraits(sources: Sources, drivers: QuerySet[Driver] | None = None) -> IngestReport:
    """Fetch the portrait of each driver (default: every driver with a Wikipedia article).

    A driver whose article no longer has a free lead image loses the stored portrait.
    """
    if sources.portraits is None:
        raise PortraitsUnavailableError("these sources have no portrait source")
    report = IngestReport()
    by_title: dict[str, list[Driver]] = {}
    for driver in (drivers if drivers is not None else Driver.objects.all()).exclude(
        wikipedia_url=""
    ):
        title = article_title(driver.wikipedia_url)
        if title:
            by_title.setdefault(title, []).append(driver)

    found = sources.portraits.portraits(list(by_title))
    now = timezone.now()
    rows = [
        DriverPortrait(
            driver=driver,
            image_url=p.image_url,
            file_page_url=p.file_page_url,
            artist=p.artist,
            license=p.license,
            license_url=p.license_url,
            fetched_at=now,
        )
        for title, p in found.items()
        for driver in by_title[title]
    ]
    missing = [d.pk for title, ds in by_title.items() if title not in found for d in ds]
    with transaction.atomic():
        DriverPortrait.objects.bulk_create(
            rows,
            update_conflicts=True,
            unique_fields=["driver"],
            update_fields=[
                "image_url",
                "file_page_url",
                "artist",
                "license",
                "license_url",
                "fetched_at",
            ],
            batch_size=500,
        )
        DriverPortrait.objects.filter(driver_id__in=missing).delete()
    report.add("portraits", len(rows))
    report.add("without_portrait", len(missing))
    log.info("portraits_ingested", **report.counts)
    return report
