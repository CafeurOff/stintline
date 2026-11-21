import datetime as dt
from typing import Any

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from stintline.analysis.models import RaceStats
from stintline.analysis.undercuts import UNDERCUT_MEDIAN_MIN_ATTEMPTS, circuit_undercuts
from stintline.racing.models import Circuit, Session, SessionKind
from stintline.racing.tests.factories import (
    CircuitFactory,
    EventFactory,
    SeasonFactory,
    SessionEntryFactory,
    SessionFactory,
)

pytestmark = pytest.mark.django_db


def attempt(gap_before: float, gap_after: float, lap: int = 20) -> dict[str, Any]:
    return {
        "attacker": 81,
        "defender": 4,
        "attacker_lap": lap,
        "defender_lap": lap + 1,
        "gap_before_s": gap_before,
        "gap_after_s": gap_after,
    }


def race(
    circuit: Circuit,
    year: int,
    undercuts: list[dict[str, Any]],
    *,
    wet: bool = False,
    kind: str = SessionKind.RACE,
) -> Session:
    event = EventFactory.create(
        circuit=circuit,
        season=SeasonFactory.create(year=year),
        race_date=dt.date(year, 8, 1),
    )
    session = SessionFactory.create(event=event, kind=kind)
    RaceStats.objects.create(
        session=session,
        format_version=1,
        built_at=timezone.now(),
        total_laps=70,
        wet=wet,
        undercuts=undercuts,
    )
    return session


def test_circuit_undercuts_gain_is_gap_before_minus_gap_after() -> None:
    circuit = CircuitFactory.create()
    race(circuit, 2025, [attempt(1.6, -5.7)])

    result = circuit_undercuts(circuit)

    only = result["attempts"][0]
    assert only["gain_s"] == pytest.approx(7.3)
    assert only["success"] is True
    assert result["successes"] == 1


def test_circuit_undercuts_median_needs_enough_dry_attempts() -> None:
    circuit = CircuitFactory.create()
    race(circuit, 2025, [attempt(1.0, 0.5)] * (UNDERCUT_MEDIAN_MIN_ATTEMPTS - 1))

    result = circuit_undercuts(circuit)

    assert result["dry_attempts"] == UNDERCUT_MEDIAN_MIN_ATTEMPTS - 1
    assert result["median_gain_s"] is None


def test_circuit_undercuts_median_counts_dry_races_only() -> None:
    circuit = CircuitFactory.create()
    race(circuit, 2024, [attempt(2.0, 1.0), attempt(2.0, 0.0), attempt(2.0, -1.0)])
    race(circuit, 2025, [attempt(1.0, 20.0)] * 3, wet=True)

    result = circuit_undercuts(circuit)

    assert len(result["attempts"]) == 6
    assert result["dry_attempts"] == 3
    assert result["median_gain_s"] == pytest.approx(2.0)


def test_circuit_undercuts_lists_newest_race_first_and_skips_sprints() -> None:
    circuit = CircuitFactory.create()
    race(circuit, 2024, [attempt(1.0, 0.5)])
    race(circuit, 2025, [attempt(1.0, -0.5, lap=30), attempt(1.0, -0.5, lap=12)])
    race(circuit, 2026, [attempt(1.0, -0.5)], kind=SessionKind.SPRINT)

    result = circuit_undercuts(circuit)

    assert result["races"] == 2
    assert [(a["year"], a["attacker_lap"]) for a in result["attempts"]] == [
        (2025, 12),
        (2025, 30),
        (2024, 20),
    ]


def test_circuit_undercuts_names_the_cars_from_that_race() -> None:
    circuit = CircuitFactory.create()
    session = race(circuit, 2025, [attempt(1.0, 0.5)])
    attacker = SessionEntryFactory.create(session=session, car_number=81, team_colour="FF8000")

    only = circuit_undercuts(circuit)["attempts"][0]

    assert only["attacker"]["driver"] == attacker.driver
    assert only["attacker"]["colour"] == "FF8000"
    assert only["defender"]["driver"] is None
    assert only["defender"]["car_number"] == 4


def test_circuit_undercuts_endpoint_of_unknown_circuit_is_a_404() -> None:
    assert APIClient().get("/api/v1/analysis/circuits/nowhere/undercuts").status_code == 404


def test_circuit_undercuts_endpoint_lists_demo_attempts(analysed: None) -> None:
    busiest = max(
        RaceStats.objects.filter(session__kind=SessionKind.RACE).select_related(
            "session__event__circuit"
        ),
        key=lambda s: len(s.undercuts),
    )
    ref = busiest.session.event.circuit.ref

    response = APIClient().get(f"/api/v1/analysis/circuits/{ref}/undercuts")

    assert response.status_code == 200
    assert response["ETag"]
    data = response.json()
    assert data["circuit"]["ref"] == ref
    assert data["attempts"]
    first = data["attempts"][0]
    assert first["attacker"]["driver"]["ref"]
    assert first["gain_s"] == pytest.approx(first["gap_before_s"] - first["gap_after_s"], abs=1e-3)
    assert data["successes"] == sum(a["success"] for a in data["attempts"])
