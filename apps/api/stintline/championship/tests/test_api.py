"""The title endpoint and the rules audit over a small stored season."""

from __future__ import annotations

import datetime as dt
from io import StringIO
from typing import Any
from unittest.mock import patch

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from stintline.championship import selectors
from stintline.racing.models import Driver, EventFormat, SessionKind, Standing
from stintline.racing.tests.factories import (
    DriverFactory,
    EventFactory,
    SeasonFactory,
    SessionEntryFactory,
    SessionFactory,
)

pytestmark = pytest.mark.django_db
TODAY = dt.date(2026, 11, 19)


def get(path: str, status: int = 200) -> Any:
    with patch("django.utils.timezone.now", return_value=dt.datetime(2026, 11, 19, tzinfo=dt.UTC)):
        response = APIClient().get(f"/api/v1/{path}")
    assert response.status_code == status, response.content
    return response.json()


def season(
    results: list[list[tuple[Driver, int, float]]], to_come: int, sprint_next: bool = False
) -> None:
    """A 2026 season: one Grand Prix per list of (driver, place, points), then rounds to come."""
    year = SeasonFactory.create(year=2026)
    for number, rows in enumerate(results, start=1):
        race = SessionFactory.create(
            event=EventFactory.create(
                season=year, round=number, race_date=dt.date(2026, 3, number)
            ),
            kind=SessionKind.RACE,
        )
        for driver, place, points in rows:
            SessionEntryFactory.create(
                session=race,
                driver=driver,
                finish_position=place,
                classification=str(place),
                points=points,
            )
    for extra in range(to_come):
        EventFactory.create(
            season=year,
            round=len(results) + extra + 1,
            race_date=dt.date(2026, 12, extra + 1),
            format=EventFormat.SPRINT if sprint_next and extra == 0 else EventFormat.CONVENTIONAL,
        )


def test_title_lists_the_leader_rivals_and_what_is_left() -> None:
    ant, ver, rus = (DriverFactory.create(ref=r, code=r[:3].upper()) for r in ("ant", "ver", "rus"))
    season(
        [[(ant, 1, 25), (ver, 2, 18), (rus, 3, 15)], [(ant, 1, 25), (ver, 2, 18), (rus, 3, 15)]], 2
    )

    body = get("seasons/2026/title")

    assert (body["races_done"], body["races_left"], body["points_left"]) == (2, 2, 50)
    assert body["decided"] is None
    assert body["next_round"]["round"] == 3
    rows = {d["driver"]["ref"]: d for d in body["drivers"]}
    assert rows["ant"]["status"] == "leader"
    assert rows["ver"]["status"] == "contender"
    assert rows["ver"]["gap"] == 14
    assert rows["rus"]["ceiling"] == 80
    assert body["rules"]["all_count"] is True


def test_leader_must_outscore_a_rival_by_the_clinch_margin() -> None:
    ant, ver = DriverFactory.create(ref="ant"), DriverFactory.create(ref="ver")
    season([[(ant, 1, 25), (ver, 2, 18)]] * 3, 2)

    body = get("seasons/2026/title")

    # 21 ahead with 50 left: after the next race 25 are left, so more than 4 is needed.
    assert body["decided"] is None
    clinch = {d["driver"]["ref"]: d["clinch_margin"] for d in body["drivers"]}
    assert clinch == {"ant": None, "ver": pytest.approx(4.0)}


def test_at_the_finale_the_leader_may_even_lose_ground() -> None:
    ant, ver = DriverFactory.create(ref="ant"), DriverFactory.create(ref="ver")
    season([[(ant, 1, 25), (ver, 2, 18)]] * 3, 1)

    body = get("seasons/2026/title")

    assert body["drivers"][1]["clinch_margin"] == pytest.approx(-21.0)


def test_settled_title_has_a_champion() -> None:
    ant, ver = DriverFactory.create(ref="ant"), DriverFactory.create(ref="ver")
    season([[(ant, 1, 25), (ver, 2, 18)]] * 5, 1, sprint_next=True)

    body = get("seasons/2026/title")

    # 35 ahead after round 5 with a Grand Prix and a sprint left (33 points): settled.
    assert body["sprints_left"] == 1
    assert body["decided"]["round"] == 5
    assert [d["status"] for d in body["drivers"]] == ["champion", "out"]


def test_title_of_an_unknown_season_is_not_found() -> None:
    assert get("seasons/1949/title", 404)["status"] == 404
    assert get("seasons/2030/title", 404)["status"] == 404


def test_audit_command_compares_with_the_official_standings() -> None:
    ant, ver = DriverFactory.create(ref="ant"), DriverFactory.create(ref="ver")
    season([[(ant, 1, 25), (ver, 2, 18)]], 0)
    year = SeasonFactory.create(year=2026)
    Standing.objects.create(season=year, round=1, driver=ant, position=1, points=25)
    Standing.objects.create(season=year, round=1, driver=ver, position=2, points=19)
    out = StringIO()

    call_command("check_title_rules", stdout=out)
    call_command("check_title_rules", "--season", "2026", stdout=out)

    assert "2026: ver 18 vs 19" in out.getvalue()
    assert "0 of 1 seasons match" in out.getvalue()
    assert selectors.audit(1949) == []
    assert selectors.audit(2025) == []
