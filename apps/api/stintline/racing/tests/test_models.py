import pytest
from django.db import IntegrityError, transaction

from stintline.racing.models import Lap, Stint
from stintline.racing.tests.factories import (
    DriverFactory,
    EventFactory,
    SessionEntryFactory,
    SessionFactory,
)

pytestmark = pytest.mark.django_db


def test_event_round_is_unique_per_season() -> None:
    event = EventFactory.create(round=3)

    with pytest.raises(IntegrityError), transaction.atomic():
        EventFactory.create(season=event.season, round=3)


def test_session_kind_is_unique_per_event() -> None:
    session = SessionFactory.create()

    with pytest.raises(IntegrityError), transaction.atomic():
        SessionFactory.create(event=session.event, kind=session.kind)


def test_car_number_is_unique_per_session() -> None:
    entry = SessionEntryFactory.create(car_number=44)

    with pytest.raises(IntegrityError), transaction.atomic():
        SessionEntryFactory.create(
            session=entry.session, car_number=44, driver=DriverFactory.create()
        )


def test_lap_number_is_unique_per_entry_and_times_are_positive() -> None:
    entry = SessionEntryFactory.create()
    Lap.objects.create(entry=entry, lap_number=1, lap_time_s=91.2)

    with pytest.raises(IntegrityError), transaction.atomic():
        Lap.objects.create(entry=entry, lap_number=1)
    with pytest.raises(IntegrityError), transaction.atomic():
        Lap.objects.create(entry=entry, lap_number=2, lap_time_s=-1.0)


def test_stint_laps_must_be_ordered() -> None:
    entry = SessionEntryFactory.create()

    with pytest.raises(IntegrityError), transaction.atomic():
        Stint.objects.create(entry=entry, stint_number=1, compound="SOFT", lap_start=10, lap_end=5)
    Stint.objects.create(entry=entry, stint_number=1, compound="SOFT", lap_start=10, lap_end=None)


def test_string_representations_are_readable() -> None:
    entry = SessionEntryFactory.create(car_number=16)
    lap = Lap.objects.create(entry=entry, lap_number=7)
    stint = Stint.objects.create(entry=entry, stint_number=2, compound="HARD")

    event = entry.session.event
    assert str(event).startswith("2025 R")
    assert str(event.season) == "2025"
    assert str(event.circuit) == event.circuit.name
    assert str(entry).startswith("#16 ")
    assert str(lap).endswith("L7")
    assert str(stint).endswith("stint 2 HARD")
    assert str(entry.team) == entry.team.name
