import datetime as dt
from io import StringIO

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from stintline.analysis import duels
from stintline.racing.models import Session, SessionEntry, SessionKind
from stintline.racing.tests.factories import (
    DriverFactory,
    EventFactory,
    SeasonFactory,
    SessionEntryFactory,
    SessionFactory,
    TeamFactory,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def analysed(seeded: None) -> None:
    call_command("build_analysis", "--all", stdout=StringIO())


def race_id(round_: int) -> int:
    return Session.objects.get(event__round=round_, kind=SessionKind.RACE).pk


def hungary_pair() -> tuple[str, str]:
    """The McLaren drivers of the Hungarian Grand Prix."""
    refs = (
        SessionEntry.objects.filter(session_id=race_id(14), car_number__in=[4, 81])
        .order_by("car_number")
        .values_list("driver__ref", flat=True)
    )
    return refs[0], refs[1]


# ------------------------------------------------------------------------------ pace


def test_pace_ranks_cars_by_fuel_corrected_median(analysed: None) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(14)}/pace")

    assert response.status_code == 200
    data = response.json()
    assert data["fuel_corrected"] is True
    assert data["cutoff_pct"] == 107
    medians = [c["summary"]["median_s"] for c in data["cars"] if c["summary"]]
    assert medians == sorted(medians)
    first = data["cars"][0]
    lap = next(lap for lap in first["laps"] if lap["kept"])
    assert lap["value_s"] < lap["time_s"]
    assert first["entry"]["driver"]["ref"]
    assert len(data["fastest_laps"]) == 10
    assert response["ETag"]


def test_pace_filters_change_the_kept_laps(analysed: None) -> None:
    client = APIClient()

    strict = client.get(f"/api/v1/sessions/{race_id(14)}/pace").json()
    loose = client.get(
        f"/api/v1/sessions/{race_id(14)}/pace", {"fuel": "false", "pit": "true", "cutoff": "0"}
    ).json()

    def kept(data: dict[str, object]) -> int:
        return sum(lap["kept"] for car in data["cars"] for lap in car["laps"])  # type: ignore[attr-defined]

    assert loose["cutoff_pct"] is None
    assert loose["fuel_corrected"] is False
    assert kept(loose) > kept(strict)


@pytest.mark.parametrize("cutoff", ["50", "300", "x"])
def test_pace_validates_the_cutoff(analysed: None, cutoff: str) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(14)}/pace", {"cutoff": cutoff})

    assert response.status_code == 400


def test_pace_of_session_without_laps_is_a_400() -> None:
    session = SessionFactory.create()

    response = APIClient().get(f"/api/v1/sessions/{session.pk}/pace")

    assert response.status_code == 400


# ----------------------------------------------------------------------------- duels


def test_head_to_head_of_two_drivers(analysed: None) -> None:
    a, b = hungary_pair()

    response = APIClient().get("/api/v1/analysis/head-to-head", {"season": "2025", "a": a, "b": b})

    assert response.status_code == 200
    data = response.json()
    assert data["a"]["driver"]["ref"] == a
    assert data["shared_rounds"] == len(data["rounds"]) > 3
    assert sum(data["race"]) <= data["shared_rounds"]
    timed = [r for r in data["rounds"] if r["session_id"] is not None]
    assert len(timed) == 3
    assert all(r["pace_gap_s"] is not None for r in timed)
    assert sum(data["pace"]) == 3
    assert data["a"]["laps_led"] is not None


def test_head_to_head_needs_two_different_drivers(analysed: None) -> None:
    a, _ = hungary_pair()

    response = APIClient().get("/api/v1/analysis/head-to-head", {"season": "2025", "a": a, "b": a})

    assert response.status_code == 400


def test_head_to_head_unknown_driver_is_a_404(analysed: None) -> None:
    a, _ = hungary_pair()

    response = APIClient().get(
        "/api/v1/analysis/head-to-head", {"season": "2025", "a": a, "b": "nobody"}
    )

    assert response.status_code == 404


def test_head_to_head_driver_absent_that_season_is_a_404(analysed: None) -> None:
    a, _ = hungary_pair()
    DriverFactory.create(ref="fangio")

    response = APIClient().get(
        "/api/v1/analysis/head-to-head", {"season": "2025", "a": a, "b": "fangio"}
    )

    assert response.status_code == 404


def test_teammates_cover_every_team(analysed: None) -> None:
    response = APIClient().get("/api/v1/analysis/seasons/2025/teammates")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 10
    points = [d["a"]["points"] + d["b"]["points"] for d in data]
    assert points == sorted(points, reverse=True)
    assert all(d["a"]["points"] >= d["b"]["points"] for d in data)


def test_teammates_of_unknown_season_is_a_404(db: None) -> None:
    assert APIClient().get("/api/v1/analysis/seasons/1949/teammates").status_code == 404


def _historic_weekend(grid: tuple[int, int], quali: tuple[float, float] | None) -> list[int]:
    season = SeasonFactory.create(year=1985)
    event = EventFactory.create(season=season, race_date=dt.date(1985, 5, 1))
    team = TeamFactory.create()
    drivers = [DriverFactory.create(), DriverFactory.create()]
    race = SessionFactory.create(event=event, kind=SessionKind.RACE)
    for driver, position in zip(drivers, grid, strict=True):
        SessionEntryFactory.create(
            session=race,
            driver=driver,
            team=team,
            grid_position=position,
            finish_position=position,
            classification=str(position),
            points=9 if position == 1 else 6,
        )
    if quali is not None:
        q = SessionFactory.create(event=event, kind=SessionKind.QUALIFYING)
        for i, (driver, time) in enumerate(zip(drivers, quali, strict=True)):
            SessionEntryFactory.create(
                session=q, driver=driver, team=team, finish_position=i + 1, q1_s=time, q2_s=None
            )
    return [d.pk for d in drivers]


def test_duel_before_qualifying_data_uses_the_grid() -> None:
    a, b = _historic_weekend(grid=(2, 1), quali=None)

    result = duels.head_to_head(1985, a, b)

    assert result is not None
    assert result["quali"] == [0, 1]
    assert result["race"] == [0, 1]
    assert result["rounds"][0]["quali_gap_s"] is None
    assert result["rounds"][0]["pace_gap_s"] is None
    assert result["a"]["laps_led"] is None


def test_duel_quali_gap_uses_the_last_shared_segment() -> None:
    a, b = _historic_weekend(grid=(1, 2), quali=(80.5, 80.75))

    result = duels.head_to_head(1985, a, b)

    assert result is not None
    assert result["rounds"][0]["quali_gap_s"] == -0.25
    assert result["median_quali_gap_s"] == -0.25


# ---------------------------------------------------------------- season and circuits


def test_consistency_ranks_drivers_by_median_spread(analysed: None) -> None:
    response = APIClient().get("/api/v1/analysis/seasons/2025/consistency")

    assert response.status_code == 200
    data = response.json()
    spreads = [d["median_spread_s"] for d in data]
    assert spreads == sorted(spreads)
    first = data[0]
    assert len(first["races"]) == 3
    assert first["best"]["spread_s"] <= first["worst"]["spread_s"]


def test_consistency_without_timed_races_is_a_404(db: None) -> None:
    SeasonFactory.create(year=1990)

    assert APIClient().get("/api/v1/analysis/seasons/1990/consistency").status_code == 404


def test_pit_stops_of_a_season(analysed: None) -> None:
    response = APIClient().get("/api/v1/analysis/seasons/2025/pit-stops")

    assert response.status_code == 200
    data = response.json()
    assert data["stops"] > 50
    stationary = [s["stationary_s"] for s in data["fastest"]]
    assert stationary == sorted(stationary)
    assert len(data["races"]) == 3
    assert all(r["pit_loss_s"] for r in data["races"])
    assert data["undercut_attempts"] == sum(r["undercut_attempts"] for r in data["races"])
    assert {t["team"]["ref"] for t in data["teams"]}


def test_pit_stops_of_unknown_season_is_a_404(db: None) -> None:
    assert APIClient().get("/api/v1/analysis/seasons/1949/pit-stops").status_code == 404


def test_circuits_show_the_track_dna(analysed: None) -> None:
    response = APIClient().get("/api/v1/analysis/circuits")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3
    hungary = next(c for c in data if c["latest_session_id"] == race_id(14))
    assert hungary["lap_length_m"]
    assert hungary["pit_loss_s"]
    assert hungary["history"][0]["winner"]["ref"]
    assert hungary["winning_stops"][0]["races"] == 1
    assert hungary["degradation_s_per_lap"] is not None
