"""Practice, qualifying and sprint-qualifying imports (ADR 0028), with in-memory sources."""

from __future__ import annotations

import datetime as dt

import pytest

from racedata.models import (
    DriverEntry,
    PitRecord,
    RaceControlRecord,
    ResultRecord,
    SessionResultRecord,
)
from racedata.models import SessionKind as SourceKind
from racedata.sources import build_fixture_sources
from stintline.ingestion import timing
from stintline.ingestion.tests.test_inconsistent_data import (
    FakeData,
    FakeSource,
    fake_sources,
    lap,
)
from stintline.racing.models import (
    Event,
    Lap,
    PitStop,
    QualifyingSegment,
    RaceControlMessage,
    Session,
    SessionEntry,
    SessionKind,
)
from stintline.racing.tests.factories import (
    DriverFactory,
    EventFactory,
    SeasonFactory,
    SessionEntryFactory,
    SessionFactory,
    TeamFactory,
)

pytestmark = pytest.mark.django_db

T0 = dt.datetime(2025, 6, 1, 13, tzinfo=dt.UTC)


def car(number: int, acronym: str | None, colour: str = "3671C6") -> DriverEntry:
    return DriverEntry(
        driver_number=number,
        acronym=acronym,
        first_name=None,
        last_name=None,
        team_name="Timing Team",
        team_colour=colour,
        media_id=f"media{number}",
    )


def rc(
    minute: int, message: str, *, phase: int | None = None, flag: str | None = None
) -> RaceControlRecord:
    return RaceControlRecord(
        occurred_at=T0 + dt.timedelta(minutes=minute),
        lap_number=None,
        category="Other",
        flag=flag,
        scope=None,
        sector=None,
        driver_number=None,
        message=message,
        qualifying_phase=phase,
    )


class NoClassification(FakeSource):
    """Jolpica has nothing for practice: asking for it would be a bug."""

    def results(self, season: int, round_: int, kind: SourceKind) -> list[ResultRecord]:
        raise AssertionError(f"Jolpica results requested for {kind}")


def weekend(kind: SessionKind) -> tuple[Session, SessionEntry]:
    """A session of round 2 and the race entry of round 1 that identifies car 4."""
    season = SeasonFactory.create(year=2025)
    previous = SessionFactory.create(event=EventFactory.create(season=season, round=1))
    norris = DriverFactory.create(ref="norris", code="NOR")
    entry = SessionEntryFactory.create(
        session=previous, driver=norris, team=TeamFactory.create(ref="mclaren"), car_number=4
    )
    event = EventFactory.create(season=season, round=2)
    return SessionFactory.create(event=event, kind=kind), entry


def test_practice_takes_identity_from_earlier_rounds_and_skips_unknown_cars() -> None:
    session, known = weekend(SessionKind.PRACTICE_1)
    data = FakeData(
        drivers=[car(4, "NOR"), car(38, "ROO")],
        laps=[lap(4, 1), lap(4, 2, 80.5), lap(4, 3, 79.9), lap(38, 1)],
        session_results=[
            SessionResultRecord(driver_number=4, position=1, best_lap_s=79.9, laps=3),
            SessionResultRecord(driver_number=38, position=2, best_lap_s=81.0, laps=1),
        ],
    )

    report = timing.ingest_session(session, fake_sources(data))

    entry = SessionEntry.objects.get(session=session)
    assert (entry.driver, entry.team, entry.car_number) == (known.driver, known.team, 4)
    assert entry.team_colour == "3671C6"
    assert (entry.finish_position, entry.fastest_lap_s, entry.laps_completed) == (1, 79.9, 3)
    assert Lap.objects.filter(entry=entry).count() == 3
    assert any("[38]" in s for s in report.skipped)
    session.refresh_from_db()
    assert session.ingested_at is not None


def test_practice_never_asks_jolpica_for_a_classification() -> None:
    session, _ = weekend(SessionKind.PRACTICE_2)
    source = NoClassification(FakeData(drivers=[car(4, "NOR")], laps=[lap(4, 1)]))
    sources = fake_sources(FakeData())
    sources = type(sources)(schedule=source, results=source, timing=source, clients=())

    report = timing.ingest_session(session, sources)

    assert report.counts["entries"] == 1


def test_a_number_given_to_another_driver_is_not_mistaken() -> None:
    session, known = weekend(SessionKind.PRACTICE_1)
    other = DriverFactory.create(ref="piastri", code="PIA")
    SessionEntryFactory.create(
        session=SessionFactory.create(event=known.session.event, kind=SessionKind.QUALIFYING),
        driver=other,
        car_number=81,
    )
    # Car 4 is now run by PIA in timing: the code wins over the number.
    data = FakeData(drivers=[car(4, "PIA")], laps=[lap(4, 1)])

    timing.ingest_session(session, fake_sources(data))

    assert SessionEntry.objects.get(session=session).driver == other


def test_deleted_laps_and_pit_laps_are_flagged() -> None:
    session, _ = weekend(SessionKind.PRACTICE_3)
    data = FakeData(
        drivers=[car(4, "NOR")],
        laps=[lap(4, 1), lap(4, 2, 80.0), lap(4, 3, 79.0), lap(4, 4, 95.0)],
        pits=[
            PitRecord(
                driver_number=4,
                lap_number=4,
                occurred_at=T0 + dt.timedelta(minutes=5),
                pit_lane_duration_s=None,
                stationary_duration_s=None,
            )
        ],
        race_control=[
            rc(4, "CAR 4 (NOR) TIME 1:19.000 DELETED - TRACK LIMITS AT TURN 4 LAP 3 13:04:00")
        ],
    )

    report = timing.ingest_session(session, fake_sources(data))

    laps = {lap.lap_number: lap for lap in Lap.objects.filter(entry__session=session)}
    assert laps[3].is_deleted
    assert not laps[2].is_deleted
    assert laps[4].is_pit_in_lap
    assert PitStop.objects.filter(entry__session=session).count() == 1
    assert report.counts["deleted_laps"] == 1


def test_qualifying_keeps_jolpica_results_and_stores_its_segments() -> None:
    session, known = weekend(SessionKind.QUALIFYING)
    SessionEntryFactory.create(
        session=session,
        driver=known.driver,
        team=known.team,
        car_number=4,
        finish_position=2,
        classification="2",
        q1_s=80.0,
        q2_s=79.5,
        q3_s=79.1,
    )
    data = FakeData(
        drivers=[car(4, "NOR", colour="FF8000")],
        laps=[lap(4, 1), lap(4, 2, 79.1)],
        session_results=[
            SessionResultRecord(
                driver_number=4,
                position=1,
                best_lap_s=79.0,
                segment_times_s=(80.1, 79.6, 79.0),
                laps=12,
            )
        ],
        race_control=[
            rc(0, "GREEN LIGHT - PIT EXIT OPEN", phase=1),
            rc(18, "CHEQUERED FLAG", phase=1, flag="CHEQUERED"),
            rc(26, "GREEN LIGHT - PIT EXIT OPEN", phase=2),
            rc(41, "CHEQUERED FLAG", phase=2, flag="CHEQUERED"),
            rc(49, "GREEN LIGHT - PIT EXIT OPEN", phase=3),
            rc(61, "CHEQUERED FLAG", phase=3, flag="CHEQUERED"),
        ],
    )

    timing.ingest_session(session, fake_sources(data))
    timing.ingest_session(session, fake_sources(data))  # idempotent

    entry = SessionEntry.objects.get(session=session)
    assert (entry.finish_position, entry.q3_s) == (2, 79.1)  # Jolpica stays canonical
    assert entry.laps_completed == 12  # what Jolpica left empty is filled
    assert entry.team_colour == "FF8000"
    segments = list(QualifyingSegment.objects.filter(session=session))
    assert [(s.number, s.ended_at - s.started_at) for s in segments] == [
        (1, dt.timedelta(minutes=18)),
        (2, dt.timedelta(minutes=15)),
        (3, dt.timedelta(minutes=12)),
    ]
    assert RaceControlMessage.objects.filter(session=session, qualifying_phase=3).count() == 2


def test_sprint_qualifying_takes_segment_times_from_timing() -> None:
    session, _ = weekend(SessionKind.SPRINT_QUALIFYING)
    data = FakeData(
        drivers=[car(4, "NOR")],
        laps=[lap(4, 1)],
        session_results=[
            SessionResultRecord(
                driver_number=4, position=16, best_lap_s=81.0, segment_times_s=(81.0, None, None)
            )
        ],
        race_control=[rc(0, "GREEN LIGHT - PIT EXIT OPEN", phase=1)],
    )

    timing.ingest_session(session, fake_sources(data))

    entry = SessionEntry.objects.get(session=session)
    assert (entry.finish_position, entry.q1_s, entry.q2_s) == (16, 81.0, None)
    assert QualifyingSegment.objects.filter(session=session).count() == 1


def test_practice_has_no_qualifying_segments() -> None:
    session, _ = weekend(SessionKind.PRACTICE_1)
    data = FakeData(drivers=[car(4, "NOR")], race_control=[rc(0, "GREEN", phase=1)])

    timing.ingest_session(session, fake_sources(data))

    assert not QualifyingSegment.objects.exists()


def test_first_round_practice_uses_the_previous_season() -> None:
    old = SessionFactory.create(event=EventFactory.create(season=SeasonFactory.create(year=2024)))
    driver = DriverFactory.create(ref="verstappen", code="VER")
    SessionEntryFactory.create(session=old, driver=driver, car_number=1)
    event = EventFactory.create(season=SeasonFactory.create(year=2025), round=1)
    session = SessionFactory.create(event=event, kind=SessionKind.PRACTICE_1)

    timing.ingest_session(session, fake_sources(FakeData(drivers=[car(1, "VER")])))

    assert SessionEntry.objects.get(session=session).driver == driver


# --- recorded OpenF1 sessions (Hungary 2025 FP1 and Q, Belgium 2025 sprint qualifying) ----


def recorded_session(round_: int, kind: SessionKind, key: int) -> Session:
    event = Event.objects.get(season__year=2025, round=round_)
    session, _ = Session.objects.update_or_create(
        event=event, kind=kind, defaults={"openf1_session_key": key}
    )
    return session


def test_recorded_practice_skips_the_reserve_drivers_it_cannot_identify(seeded: None) -> None:
    session = recorded_session(14, SessionKind.PRACTICE_1, 9921)

    report = timing.ingest_session(session, build_fixture_sources())

    entries = SessionEntry.objects.filter(session=session)
    # Drugovich (34) and Aron (97) drove in FP1 but had never raced: no identity.
    assert entries.count() == 18
    assert "timing cars without a known driver: [34, 97]" in report.skipped
    fastest = entries.get(finish_position=1)
    assert (fastest.driver.ref, fastest.fastest_lap_s) == ("norris", 76.052)
    assert Lap.objects.filter(entry__session=session, is_pit_out_lap=True).exists()


def test_recorded_qualifying_has_three_segments_and_deleted_laps(seeded: None) -> None:
    session = recorded_session(14, SessionKind.QUALIFYING, 9924)

    report = timing.ingest_session(session, build_fixture_sources())

    assert report.counts["qualifying_segments"] == 3
    assert report.counts["deleted_laps"] == 3
    pole = SessionEntry.objects.get(session=session, finish_position=1)
    assert (pole.driver.ref, pole.q3_s) == ("leclerc", 75.372)
    assert Lap.objects.filter(entry__session=session, is_deleted=True).count() == 3


def test_recorded_sprint_qualifying_is_classified_from_timing(seeded: None) -> None:
    session = recorded_session(13, SessionKind.SPRINT_QUALIFYING, 9930)

    timing.ingest_session(session, build_fixture_sources())

    entries = SessionEntry.objects.filter(session=session)
    assert entries.count() == 20
    assert entries.get(finish_position=1).q3_s == 100.51
    assert entries.filter(q2_s__isnull=True).count() == 5  # knocked out in SQ1
    assert QualifyingSegment.objects.filter(session=session).count() == 3
