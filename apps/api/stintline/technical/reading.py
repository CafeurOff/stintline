"""Turn the FIA technical PDFs into rows (ADR 0019), registered as paddock readers."""

from __future__ import annotations

import re
import unicodedata

import structlog
from django.db import transaction

from racedata.providers.fia_technical import (
    parse_car_presentation,
    parse_new_pu,
    parse_pu_usage,
)
from stintline.paddock.models import FiaDocument
from stintline.paddock.readers import DocumentReader
from stintline.racing.models import Driver, Event, SessionEntry, Team
from stintline.technical.models import (
    CarUpgrade,
    CarZone,
    PowerUnitChange,
    PowerUnitUsage,
    TeamWithoutUpgrade,
)

log = structlog.get_logger(__name__)

GENERIC_WORDS = frozenset(
    {"f1", "team", "racing", "formula", "1", "one", "scuderia", "hp", "the", "and", "of"}
)
"""Words every team name shares: they never decide which team is meant."""

# First match wins, most specific first ("beam wing" before "rear wing").
ZONES: tuple[tuple[CarZone, tuple[str, ...]], ...] = (
    (CarZone.BEAM_WING, ("beam wing",)),
    (CarZone.REAR_WING, ("rear wing", "drs", "endplate", "end plate")),
    (CarZone.FRONT_WING, ("front wing", "fw ")),
    (CarZone.NOSE, ("nose",)),
    (CarZone.DIFFUSER, ("diffuser",)),
    (CarZone.FLOOR, ("floor", "plank", "fence", "skid")),
    (CarZone.FRONT_SUSPENSION, ("front suspension", "front wishbone", "front pushrod")),
    (CarZone.REAR_SUSPENSION, ("rear suspension", "rear wishbone", "rear pullrod")),
    (CarZone.FRONT_CORNER, ("front corner", "front brake", "front wheel", "front drum")),
    (CarZone.REAR_CORNER, ("rear corner", "rear brake", "rear wheel", "rear drum")),
    (CarZone.SIDEPOD, ("sidepod", "side pod", "radiator", "inlet", "side impact")),
    (
        CarZone.ENGINE_COVER,
        ("engine cover", "louvre", "louver", "cooling", "bodywork", "coke", "exhaust", "gill"),
    ),
    (CarZone.COCKPIT, ("mirror", "halo", "cockpit", "chassis", "headrest")),
)


def zone_of(component: str) -> CarZone:
    lowered = f"{component.lower()} "
    return next((zone for zone, words in ZONES if any(w in lowered for w in words)), CarZone.OTHER)


def _words(name: str) -> frozenset[str]:
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return frozenset(re.findall(r"[a-z0-9]+", plain)) - GENERIC_WORDS


def match_team(event: Event, name: str) -> Team | None:
    """The team of the weekend whose names (Jolpica name, timing display name) share the
    most words with the name the team printed ("Oracle Red Bull Racing" → Red Bull)."""
    wanted = _words(name)
    best: tuple[int, Team | None] = (0, None)
    seen: dict[int, set[str]] = {}
    entries = SessionEntry.objects.filter(session__event=event).select_related("team")
    for entry in entries:
        names = seen.setdefault(entry.team_id, set())
        names.update(_words(entry.team.name) | _words(entry.team_display_name))
        score = len(wanted & names)
        if score > best[0]:
            best = (score, entry.team)
    return best[1]


def _drivers(event: Event) -> dict[int, Driver]:
    entries = SessionEntry.objects.filter(session__event=event).select_related("driver")
    return {e.car_number: e.driver for e in entries.order_by("session__starts_at")}


def read_car_presentation(document: FiaDocument, content: bytes) -> None:
    upgrades, without = parse_car_presentation(content)
    event = document.event
    with transaction.atomic():
        CarUpgrade.objects.filter(document=document).delete()
        TeamWithoutUpgrade.objects.filter(document=document).delete()
        CarUpgrade.objects.bulk_create(
            [
                CarUpgrade(
                    document=document,
                    event=event,
                    team=match_team(event, u.team_name),
                    team_name=u.team_name[:128],
                    number=u.number,
                    component=u.component[:128],
                    zone=zone_of(u.component),
                    reason=u.reason.value,
                    reason_detail=u.reason_detail[:200],
                    difference=u.difference,
                    description=u.description,
                )
                for u in upgrades
            ],
            ignore_conflicts=True,
        )
        TeamWithoutUpgrade.objects.bulk_create(
            [
                TeamWithoutUpgrade(
                    document=document, event=event, team=match_team(event, name), team_name=name
                )
                for name in without
            ],
            ignore_conflicts=True,
        )
    log.info("technical_upgrades_read", document_id=document.pk, upgrades=len(upgrades))


def read_pu_usage(document: FiaDocument, content: bytes) -> None:
    records = parse_pu_usage(content)
    drivers = _drivers(document.event)
    with transaction.atomic():
        PowerUnitUsage.objects.filter(document=document).delete()
        PowerUnitUsage.objects.bulk_create(
            [
                PowerUnitUsage(
                    document=document,
                    event=document.event,
                    car_number=r.car,
                    driver=drivers.get(r.car),
                    label=r.label[:128],
                    element=element,
                    used=used,
                )
                for r in records
                for element, used in r.used.items()
            ],
            ignore_conflicts=True,
        )
    log.info("technical_pu_usage_read", document_id=document.pk, cars=len(records))


def read_new_pu(document: FiaDocument, content: bytes) -> None:
    records = parse_new_pu(content)
    drivers = _drivers(document.event)
    with transaction.atomic():
        PowerUnitChange.objects.filter(document=document).delete()
        PowerUnitChange.objects.bulk_create(
            [
                PowerUnitChange(
                    document=document,
                    event=document.event,
                    car_number=r.car,
                    driver=drivers.get(r.car),
                    label=r.label[:128],
                    element=r.element,
                    previous=r.previous,
                    number=r.number,
                    allowed=r.allowed,
                    compliant=r.compliant,
                )
                for r in records
            ],
            ignore_conflicts=True,
        )
    log.info("technical_pu_changes_read", document_id=document.pk, changes=len(records))


READERS = (
    DocumentReader("car-presentation", ("car presentation",), read_car_presentation),
    DocumentReader("pu-usage", ("pu elements used",), read_pu_usage),
    DocumentReader("pu-new", ("new pu elements",), read_new_pu),
)
