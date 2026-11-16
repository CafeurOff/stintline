import datetime as dt
from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from stintline.paddock import readers
from stintline.paddock.models import FiaDocument
from stintline.racing.models import Event
from stintline.technical import reading, selectors
from stintline.technical.models import (
    CarUpgrade,
    CarZone,
    PowerUnitChange,
    PowerUnitUsage,
    TeamWithoutUpgrade,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def analysed(seeded: None) -> None:
    call_command("build_analysis", "--all", stdout=StringIO())


def hungary() -> Event:
    return Event.objects.get(season__year=2025, round=14)


# --------------------------------------------------------------------- reading


def test_seed_reads_the_upgrades_of_hungary(seeded: None) -> None:
    rows = CarUpgrade.objects.filter(event=hungary()).select_related("team")

    assert rows.count() == 5
    teams = {u.team.ref for u in rows if u.team}
    assert {"red_bull", "aston_martin", "rb"} <= teams
    louvres = rows.get(component="Cooling Louvres")
    assert louvres.zone == CarZone.ENGINE_COVER
    assert louvres.reason == "circuit"
    assert TeamWithoutUpgrade.objects.get(event=hungary()).team is not None


def test_seed_reads_power_unit_usage_and_changes(seeded: None) -> None:
    usage = PowerUnitUsage.objects.filter(event=hungary())
    gasly = PowerUnitChange.objects.get(event=hungary(), element="EX")

    assert usage.values("car_number").distinct().count() == 20
    assert usage.filter(driver__isnull=True).count() == 0
    assert (gasly.car_number, gasly.number, gasly.allowed, gasly.compliant) == (10, 5, 8, True)
    assert gasly.driver is not None
    assert PowerUnitChange.objects.filter(event=hungary()).count() == 5


def test_reading_again_replaces_the_rows(seeded: None) -> None:
    document = FiaDocument.objects.get(event=hungary(), title="Car Presentation Submissions")
    path = "fia/system/files/decision-document"
    from racedata.fixtures import FIXTURES_ROOT

    content = next((FIXTURES_ROOT / path).glob("*car_presentation*/_.pdf")).read_bytes()

    reading.read_car_presentation(document, content)

    assert CarUpgrade.objects.filter(document=document).count() == 5


@pytest.mark.parametrize(
    ("component", "zone"),
    [
        ("Beam Wing", CarZone.BEAM_WING),
        ("Rear Wing Endplate", CarZone.REAR_WING),
        ("Front Wing", CarZone.FRONT_WING),
        ("Floor Edge", CarZone.FLOOR),
        ("Front corner", CarZone.FRONT_CORNER),
        ("Sidepod Inlet", CarZone.SIDEPOD),
        ("Mirror stay", CarZone.COCKPIT),
        ("Steering wheel", CarZone.OTHER),
    ],
)
def test_zone_of_a_component(component: str, zone: CarZone) -> None:
    assert reading.zone_of(component) == zone


def test_registered_readers_handle_technical_titles(seeded: None) -> None:
    pu = FiaDocument.objects.filter(title__icontains="PU elements used").first()
    notes = FiaDocument.objects.filter(title__icontains="Event Notes").first()

    assert pu is not None
    assert notes is not None
    assert [r.name for r in readers.readers_for(pu)] == ["pu-usage"]
    assert readers.readers_for(notes) == []


def test_read_technical_command(seeded: None) -> None:
    out = StringIO()

    call_command("read_technical", "--season", "2025", stdout=out)  # all read by the seed
    call_command("read_technical", "--season", "2025", "--limit", "4", "--all", stdout=out)

    assert out.getvalue().splitlines() == [
        "0 technical documents read",
        "4 technical documents read",
    ]


# ------------------------------------------------------------------- selectors


def test_pace_around_needs_two_races_a_side() -> None:
    day = dt.date(2025, 6, 1)
    series = [(day + dt.timedelta(days=7 * i), i, float(i)) for i in range(8)]

    before, after, n_before, n_after = selectors.pace_around(series, day + dt.timedelta(days=28))

    assert (n_before, n_after) == (3, 3)
    assert (before, after) == (2.0, 5.0)
    assert selectors.pace_around(series[:1], day + dt.timedelta(days=7))[0] is None


# ------------------------------------------------------------------------- API


def test_upgrades_by_team_and_round_with_pace(analysed: None) -> None:
    response = APIClient().get("/api/v1/technical/upgrades", {"season": 2025})

    assert response.status_code == 200
    data = response.json()
    assert [r["round"] for r in data["rounds"]] == [14]
    red_bull = next(t for t in data["teams"] if t["team"] and t["team"]["ref"] == "red_bull")
    [cell] = red_bull["cells"]
    assert cell["count"] == 2
    assert cell["pace_before_pct"] is None  # one race before Hungary in the demo
    assert cell["pace_after_pct"] is not None
    assert len(data["upgrades"]) == 5


def test_power_units_against_the_allowance(seeded: None) -> None:
    data = APIClient().get("/api/v1/technical/power-units", {"season": 2025}).json()

    assert data["elements"] == ["ICE", "TC", "MGU-H", "MGU-K", "ES", "CE", "EX"]
    assert data["allowed"] == {"EX": 8, "ES": 2, "CE": 2}
    assert len(data["cars"]) == 20
    gasly = next(c for c in data["cars"] if c["car_number"] == 10)
    assert gasly["changes"][0]["element"] == "EX"
    assert data["as_of"]["round"] == 14


def test_incidents_by_kind_and_licence_points(seeded: None) -> None:
    data = APIClient().get("/api/v1/technical/incidents", {"season": 2025}).json()

    assert data["threshold"] == 12
    kinds = {k["kind"] for k in data["kinds"]}
    assert "collision" in kinds
    leclerc = next(d for d in data["drivers"] if d["driver"]["ref"] == "leclerc")
    assert leclerc["points_12m"] == 1
    assert leclerc["points_by_round"] == [1]
    assert len(data["decisions"]) == 7


@pytest.mark.parametrize("path", ["upgrades", "power-units", "incidents"])
def test_seasons_without_documents_are_404(db: None, path: str) -> None:
    client = APIClient()

    assert client.get(f"/api/v1/technical/{path}", {"season": 1990}).status_code == 404
    assert client.get(f"/api/v1/technical/{path}").status_code == 400
