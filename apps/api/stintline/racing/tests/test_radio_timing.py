"""Where a team radio message sits in its lap, for replays (ADR 0029)."""

from __future__ import annotations

import datetime as dt

import pytest
from rest_framework.test import APIClient

from stintline.racing import selectors
from stintline.racing.models import Lap, TeamRadio
from stintline.racing.tests.factories import SessionEntryFactory

pytestmark = pytest.mark.django_db

T0 = dt.datetime(2026, 11, 22, 4, 3, tzinfo=dt.UTC)


def at(seconds: float) -> dt.datetime:
    return T0 + dt.timedelta(seconds=seconds)


def test_each_message_is_placed_within_its_lap() -> None:
    # Arrange: lap 1 timed (90 s), lap 2 not timed (a red flag), lap 3 the last one, untimed.
    entry = SessionEntryFactory.create(car_number=63)
    for number, start, seconds in ((1, 0, 90.0), (2, 90, None), (3, 190, None)):
        Lap.objects.create(entry=entry, lap_number=number, started_at=at(start), lap_time_s=seconds)
    for seconds in (-30, 45, 140, 400):
        TeamRadio.objects.create(
            session=entry.session,
            car_number=63,
            recorded_at=at(seconds),
            url=f"https://x.test/{seconds}.mp3",
        )

    # Act
    messages = selectors.session_radio(entry.session.pk)

    # Assert
    assert [(m.lap, m.lap_fraction) for m in messages] == [
        (None, None),  # before the start
        (1, 0.5),
        (2, 0.5),  # from the next lap's start
        (3, None),  # no length for the last lap
    ]


def test_a_message_after_the_flag_is_placed_at_the_finish() -> None:
    entry = SessionEntryFactory.create(car_number=1)
    Lap.objects.create(entry=entry, lap_number=1, started_at=at(0), lap_time_s=90.0)
    TeamRadio.objects.create(
        session=entry.session, car_number=1, recorded_at=at(150), url="https://x.test/b.mp3"
    )

    body = APIClient().get(f"/api/v1/sessions/{entry.session.pk}/radio").json()

    assert body[0]["lap"] == 1
    assert body[0]["lap_fraction"] == 1.0
