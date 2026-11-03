import json
from io import StringIO
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command

from stintline.racing.models import Lap, Session, SessionKind, Stint
from stintline.strategy_api.adapters import race_from_session
from stintline_strategy.domain import Compound, Neutralisation

pytestmark = pytest.mark.django_db


@pytest.fixture
def seeded() -> None:
    call_command("seed_demo", stdout=StringIO())


def race_session(round_: int) -> Session:
    return Session.objects.select_related("event").get(event__round=round_, kind=SessionKind.RACE)


def test_race_from_session_builds_engine_inputs(seeded: None) -> None:
    race = race_from_session(race_session(4))

    assert race.name == "Bahrain Grand Prix"
    assert race.total_laps == 57
    assert len(race.cars) == 20
    assert race.neutralisations[0].kind is Neutralisation.SAFETY_CAR
    assert (race.neutralisations[0].lap_start, race.neutralisations[0].lap_end) == (32, 35)
    assert len(race.pit_stops) == 42


def test_tyre_age_and_race_time_are_derived(seeded: None) -> None:
    race = race_from_session(race_session(14))
    norris = race.laps_of(4)

    assert norris[0].tyre_age == 0
    assert norris[0].compound is not Compound.UNKNOWN
    # Out-lap age equals the set's age when fitted: Norris's hards were a used set (1 lap).
    out_lap = next(lap for lap in norris if lap.is_pit_out)
    stint = Stint.objects.get(entry__session__event__round=14, entry__car_number=4, stint_number=2)
    assert out_lap.lap == stint.lap_start == 32
    assert out_lap.tyre_age == stint.tyre_age_at_start == 1
    times = [lap.end_time_s for lap in norris if lap.end_time_s is not None]
    assert times == sorted(times)
    assert times[-1] == pytest.approx(5721.2, abs=5.0)  # race time 1:35:21.231


def test_end_time_falls_back_to_start_plus_duration(seeded: None) -> None:
    session = race_session(16)
    last = Lap.objects.filter(entry__session=session).order_by("-lap_number").first()
    assert last is not None

    race = race_from_session(session)

    lap = next(x for x in race.laps if x.car == last.entry.car_number and x.lap == last.lap_number)
    assert lap.end_time_s is not None


def test_session_without_laps_is_rejected(seeded: None) -> None:
    qualifying = Session.objects.filter(kind=SessionKind.QUALIFYING).first()
    assert qualifying is not None

    with pytest.raises(ValueError, match="has no laps"):
        race_from_session(qualifying)


def test_backtest_command_reports_both_modes(seeded: None, tmp_path: Path) -> None:
    out = StringIO()
    target = tmp_path / "backtest.json"

    call_command("backtest", "--rounds", "14", "16", "--json", str(target), stdout=out)

    text = out.getvalue()
    assert "### Mode: blind" in text
    assert "### Mode: scenario" in text
    assert "Hungarian Grand Prix" in text
    payload = json.loads(target.read_text())
    assert payload["blind"]["overall"]["n"] > 30
    assert payload["scenario"]["overall"]["mae"] < payload["blind"]["overall"]["baseline_mae"]


def test_backtest_command_needs_ingested_races() -> None:
    with pytest.raises(CommandError, match="seed_demo"):
        call_command("backtest", stdout=StringIO())
