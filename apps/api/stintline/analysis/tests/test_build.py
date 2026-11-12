from io import StringIO

import pytest
from django.core.management import call_command

from stintline.analysis import build, tasks
from stintline.analysis.models import EntryRaceStats, RaceStats
from stintline.racing.models import PitStop, Session, SessionKind, Stint
from stintline.racing.tests.factories import SessionEntryFactory, SessionFactory

pytestmark = pytest.mark.django_db


def race(round_: int) -> Session:
    return Session.objects.select_related("event").get(event__round=round_, kind=SessionKind.RACE)


def test_build_race_stats_stores_race_and_driver_figures(seeded: None) -> None:
    session = race(14)

    stats = build.build_race_stats(session)

    assert stats is not None
    assert stats.format_version == build.ANALYSIS_FORMAT
    assert stats.total_laps == 70
    assert stats.pit_loss_s is not None
    assert 15 < stats.pit_loss_s < 30
    assert stats.passes is not None
    assert stats.passes > 0
    assert stats.winner_strategy[0] in {"SOFT", "MEDIUM", "HARD"}
    assert set(stats.degradation) <= {"SOFT", "MEDIUM", "HARD"}
    rows = EntryRaceStats.objects.filter(entry__session=session)
    assert rows.count() == 20
    assert sum(r.laps_led or 0 for r in rows) == stats.total_laps
    assert sum(r.passes_made or 0 for r in rows) == stats.passes
    assert sum(r.passes_made or 0 for r in rows) == sum(r.passes_lost or 0 for r in rows)


def test_build_uses_the_fastest_stored_telemetry_lap(seeded: None) -> None:
    stats = build.build_race_stats(race(14))

    assert stats is not None
    assert stats.lap_length_m is not None
    assert 4000 < stats.lap_length_m < 4800
    assert stats.top_speed_kph is not None
    assert stats.top_speed_kph > 250
    assert stats.full_throttle_share is not None
    assert 0 < stats.full_throttle_share < 1
    assert stats.braking_zones


def test_build_without_telemetry_leaves_lap_figures_empty(seeded: None) -> None:
    stats = build.build_race_stats(race(4))

    assert stats is not None
    assert stats.lap_length_m is None
    assert stats.braking_zones is None


def test_build_is_idempotent(seeded: None) -> None:
    session = race(4)

    build.build_race_stats(session)
    build.build_race_stats(session)

    assert RaceStats.objects.filter(session=session).count() == 1
    assert EntryRaceStats.objects.filter(entry__session=session).count() == 20


def test_drivers_with_few_clean_laps_get_no_pace(seeded: None) -> None:
    build.build_race_stats(race(4))

    short = EntryRaceStats.objects.filter(
        entry__session=race(4), clean_laps__lt=build.MIN_CLEAN_LAPS
    )

    assert all(r.median_s is None and r.spread_s is None for r in short)


def test_session_without_laps_is_skipped() -> None:
    session = SessionFactory.create()
    SessionEntryFactory.create(session=session)

    assert build.build_race_stats(session) is None
    assert not RaceStats.objects.exists()


def test_stale_sessions_lists_missing_and_outdated_builds(seeded: None) -> None:
    stale_before = set(build.stale_sessions().values_list("pk", flat=True))
    build.build_race_stats(race(4))
    RaceStats.objects.filter(session=race(4)).update(format_version=0)
    build.build_race_stats(race(16))

    stale_after = set(build.stale_sessions().values_list("pk", flat=True))

    assert {race(4).pk, race(14).pk, race(16).pk} <= stale_before
    assert race(4).pk in stale_after
    assert race(16).pk not in stale_after


def test_tyre_strategy_merges_splits_without_a_stop(seeded: None) -> None:
    entry = race(14).entries.get(finish_position=1)
    stints = list(Stint.objects.filter(entry=entry))
    pit_laps = set(PitStop.objects.filter(entry=entry).values_list("lap_number", flat=True))
    duplicated = [*stints, Stint(stint_number=99, compound=stints[-1].compound, lap_start=69)]

    assert build.tyre_strategy(duplicated, pit_laps) == build.tyre_strategy(stints, pit_laps)
    assert len(build.tyre_strategy(stints, pit_laps)) == len(pit_laps) + 1


def test_tasks_build_one_race_and_the_stale_ones(seeded: None) -> None:
    assert tasks.build_race_analysis(race(14).pk) is True

    built = tasks.build_stale_analysis()

    assert built == 2
    assert not build.stale_sessions().exists()


def test_command_builds_stale_season_session_or_all(seeded: None) -> None:
    out = StringIO()

    call_command("build_analysis", "--session", str(race(4).pk), stdout=out)
    call_command("build_analysis", stdout=out)
    call_command("build_analysis", "--season", "2025", stdout=out)
    call_command("build_analysis", "--all", stdout=out)

    assert out.getvalue().splitlines() == [
        "1 races analysed",
        "2 races analysed",
        "3 races analysed",
        "3 races analysed",
    ]


@pytest.mark.parametrize(
    ("changes", "reliable"),
    [
        ({}, True),
        ({"wet": True}, False),
        ({"pit_loss_stops": 6}, False),
        ({"pit_loss_sigma_s": 9.0}, False),
        ({"pit_loss_s": None}, False),
    ],
)
def test_pit_loss_reliable_needs_dry_tight_and_enough_stops(
    changes: dict[str, object], reliable: bool
) -> None:
    values: dict[str, object] = {
        "pit_loss_s": 22.0,
        "pit_loss_sigma_s": 1.2,
        "pit_loss_stops": 20,
        "wet": False,
        **changes,
    }

    assert RaceStats(**values).pit_loss_reliable is reliable
