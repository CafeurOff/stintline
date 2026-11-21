import datetime as dt
from typing import Any

import pytest
from rest_framework.test import APIClient

from stintline.analysis.models import EntryRaceStats
from stintline.racing.careers import FORM_MIN_CLEAN_LAPS, FORM_RACES
from stintline.racing.models import Driver, SessionEntry, SessionKind, Team
from stintline.racing.tests.factories import (
    DriverFactory,
    EventFactory,
    SessionEntryFactory,
    SessionFactory,
    TeamFactory,
)

pytestmark = pytest.mark.django_db


def _race(
    driver: Driver,
    team: Team,
    date: dt.date,
    *,
    kind: SessionKind = SessionKind.RACE,
    classification: str = "1",
    **fields: Any,
) -> SessionEntry:
    event = EventFactory.create(season__year=date.year, race_date=date)
    session = SessionFactory.create(event=event, kind=kind)
    return SessionEntryFactory.create(
        session=session, driver=driver, team=team, classification=classification, **fields
    )


def _pace(entry: SessionEntry, median_s: float, clean_laps: int = 40) -> None:
    EntryRaceStats.objects.create(
        entry=entry, clean_laps=clean_laps, median_s=median_s + 1, median_corrected_s=median_s
    )


def _teammate(entry: SessionEntry, driver: Driver | None = None) -> SessionEntry:
    return SessionEntryFactory.create(
        session=entry.session, driver=driver or DriverFactory.create(), team=entry.team
    )


def _form(ref: str) -> dict[str, Any]:
    response = APIClient().get(f"/api/v1/drivers/{ref}/form")
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    return body


def test_driver_form_last_races_oldest_first_across_seasons() -> None:
    driver, team = DriverFactory.create(), TeamFactory.create()
    dates = [
        dt.date(2024, 11, 3),
        dt.date(2024, 12, 8),
        *(dt.date(2025, m, 1) for m in (3, 4, 5, 6)),
    ]
    for date in dates:
        _race(driver, team, date)

    races = _form(driver.ref)["races"]

    assert len(races) == FORM_RACES
    assert [r["race_date"] for r in races] == [d.isoformat() for d in dates[1:]]
    assert [r["season"] for r in races] == [2024, 2025, 2025, 2025, 2025]


def test_driver_form_leaves_out_sprints_and_races_not_started() -> None:
    driver, team = DriverFactory.create(), TeamFactory.create()
    _race(driver, team, dt.date(2025, 3, 1))
    _race(driver, team, dt.date(2025, 4, 1), kind=SessionKind.SPRINT)
    _race(driver, team, dt.date(2025, 5, 1), classification="W")

    races = _form(driver.ref)["races"]

    assert [r["race_date"] for r in races] == ["2025-03-01"]


def test_driver_form_pace_gap_is_driver_minus_teammate() -> None:
    driver, team = DriverFactory.create(), TeamFactory.create()
    entry = _race(driver, team, dt.date(2025, 3, 1))
    _pace(entry, 90.0)
    _pace(_teammate(entry), 90.25)

    race = _form(driver.ref)["races"][0]

    assert race["pace_gap_s"] == -0.25


def test_driver_form_no_gap_when_teammate_has_too_few_clean_laps() -> None:
    driver, team = DriverFactory.create(), TeamFactory.create()
    entry = _race(driver, team, dt.date(2025, 3, 1))
    _pace(entry, 90.0)
    _pace(_teammate(entry), 89.0, clean_laps=FORM_MIN_CLEAN_LAPS - 1)

    body = _form(driver.ref)

    assert body["min_clean_laps"] == FORM_MIN_CLEAN_LAPS
    assert body["races"][0]["pace_gap_s"] is None


def test_driver_form_race_without_timing_has_no_gap() -> None:
    driver, team = DriverFactory.create(), TeamFactory.create()
    entry = _race(driver, team, dt.date(1998, 3, 8), grid_position=3, finish_position=1)
    _teammate(entry)

    race = _form(driver.ref)["races"][0]

    assert race["has_data"] is False
    assert race["pace_gap_s"] is None
    assert (race["grid_position"], race["finish_position"]) == (3, 1)


def test_driver_form_names_a_stand_in_teammate() -> None:
    driver, team = DriverFactory.create(), TeamFactory.create()
    entry = _race(driver, team, dt.date(2025, 3, 1))
    _race(DriverFactory.create(ref="regular"), team, dt.date(2025, 2, 1))
    _teammate(entry, DriverFactory.create(ref="stand-in", family_name="Reserve"))
    SessionEntryFactory.create(session=entry.session)  # another team's car

    race = _form(driver.ref)["races"][0]

    assert race["teammate"]["ref"] == "stand-in"
    assert race["teammate"]["family_name"] == "Reserve"


def test_driver_form_empty_for_a_driver_without_grands_prix() -> None:
    driver = DriverFactory.create()

    assert _form(driver.ref)["races"] == []


def test_driver_form_unknown_driver_is_404() -> None:
    response = APIClient().get("/api/v1/drivers/nobody/form")

    assert response.status_code == 404


def test_driver_form_from_seeded_season(seeded: None) -> None:
    races = _form("norris")["races"]

    assert [(r["season"], r["round"]) for r in races] == [(2025, n) for n in range(20, 25)]
    assert races[-1]["event_name"] == "Abu Dhabi Grand Prix"
    assert all(r["teammate"]["ref"] == "piastri" for r in races)


def test_driver_form_pace_gaps_from_analysed_races(analysed: None) -> None:
    SessionEntry.objects.filter(
        session__event__season__year=2025, session__event__round__gt=16
    ).delete()

    races = _form("norris")["races"]

    assert [(r["round"], r["pace_gap_s"]) for r in races] == [
        (12, None),
        (13, None),
        (14, 0.099),
        (15, None),
        (16, -0.125),
    ]
