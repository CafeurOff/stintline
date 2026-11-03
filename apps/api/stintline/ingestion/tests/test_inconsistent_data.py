"""Ingestion of missing or inconsistent upstream data, with in-memory sources."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

import pytest

from racedata.errors import UpstreamUnavailableError
from racedata.models import (
    CircuitInfo,
    Compound,
    DriverEntry,
    EventFormat,
    EventInfo,
    JolpicaPitStop,
    LapRecord,
    PitRecord,
    PositionSample,
    RaceControlRecord,
    ResultRecord,
    ScheduledSession,
    StintRecord,
    TeamRadioRecord,
    TimingSession,
    WeatherRecord,
)
from racedata.models import SessionKind as SourceKind
from racedata.sources import Sources
from stintline.ingestion import services
from stintline.racing.models import (
    Lap,
    PitStop,
    Session,
    SessionEntry,
    SessionKind,
    Stint,
    TrackOutline,
)
from stintline.racing.tests.factories import SessionFactory

pytestmark = pytest.mark.django_db

T0 = dt.datetime(2025, 6, 1, 13, tzinfo=dt.UTC)


def result(driver_id: str, number: int, position: int | None = 1) -> ResultRecord:
    return ResultRecord(
        driver_id=driver_id,
        code=driver_id[:3].upper(),
        given_name="Test",
        family_name=driver_id.title(),
        car_number=number,
        constructor_id="team",
        constructor_name="Team",
        grid=1,
        position=position,
        position_text=str(position) if position else "R",
        status="Finished" if position else "Retired",
        points=0.0,
        laps_completed=3,
    )


def lap(number: int, lap_no: int, seconds: float | None = 90.0) -> LapRecord:
    return LapRecord(
        driver_number=number,
        lap_number=lap_no,
        lap_time_s=seconds,
        sector_1_s=None,
        sector_2_s=None,
        sector_3_s=None,
        is_pit_out_lap=False,
        started_at=T0 + dt.timedelta(minutes=lap_no),
        speed_trap_kph=None,
    )


@dataclass
class FakeData:
    results: list[ResultRecord] = field(default_factory=list)
    drivers: list[DriverEntry] = field(default_factory=list)
    laps: list[LapRecord] = field(default_factory=list)
    stints: list[StintRecord] = field(default_factory=list)
    pits: list[PitRecord] = field(default_factory=list)
    jolpica_pits: list[JolpicaPitStop] = field(default_factory=list)
    weather: list[WeatherRecord] = field(default_factory=list)
    race_control: list[RaceControlRecord] = field(default_factory=list)
    events: list[EventInfo] = field(default_factory=list)
    timing_sessions: list[TimingSession] = field(default_factory=list)
    locations: list[PositionSample] = field(default_factory=list)
    team_radio: list[TeamRadioRecord] = field(default_factory=list)


class FakeSource:
    def __init__(self, data: FakeData) -> None:
        self.d = data

    def season_events(self, season: int) -> list[EventInfo]:
        return self.d.events

    def results(self, season: int, round_: int, kind: SourceKind) -> list[ResultRecord]:
        return self.d.results

    def pit_stops(self, season: int, round_: int) -> list[JolpicaPitStop]:
        return self.d.jolpica_pits

    def sessions(self, year: int, kind: SourceKind | None = None) -> list[TimingSession]:
        return [s for s in self.d.timing_sessions if kind is None or s.kind is kind]

    def drivers(self, session_key: int) -> list[DriverEntry]:
        return self.d.drivers

    def laps(self, session_key: int) -> list[LapRecord]:
        return self.d.laps

    def stints(self, session_key: int) -> list[StintRecord]:
        return self.d.stints

    def pit(self, session_key: int) -> list[PitRecord]:
        return self.d.pits

    def race_control(self, session_key: int) -> list[RaceControlRecord]:
        return self.d.race_control

    def weather(self, session_key: int) -> list[WeatherRecord]:
        return self.d.weather

    def locations(
        self, session_key: int, driver_number: int, start: dt.datetime, end: dt.datetime
    ) -> list[PositionSample]:
        return self.d.locations

    def team_radio(self, session_key: int) -> list[TeamRadioRecord]:
        return self.d.team_radio


def fake_sources(data: FakeData) -> Sources:
    source = FakeSource(data)
    return Sources(schedule=source, results=source, timing=source, clients=())


def test_timing_rows_for_unclassified_cars_are_skipped() -> None:
    session = SessionFactory.create()
    data = FakeData(
        results=[result("alpha", 10)],
        drivers=[
            DriverEntry(
                driver_number=10,
                acronym="ALP",
                first_name=None,
                last_name=None,
                team_name=None,
                team_colour="ff0000",
            ),
            DriverEntry(
                driver_number=99,
                acronym="GHO",
                first_name=None,
                last_name=None,
                team_name=None,
                team_colour=None,
            ),
        ],
        laps=[lap(10, 1), lap(10, 2, None), lap(99, 1)],
    )

    report = services.ingest_session(session, fake_sources(data))

    assert SessionEntry.objects.get(session=session).team_colour == "ff0000"
    assert Lap.objects.count() == 2
    assert Lap.objects.get(lap_number=2).lap_time_s is None
    assert any("[99]" in s for s in report.skipped)


def test_inverted_stint_bounds_are_dropped_not_fatal() -> None:
    session = SessionFactory.create()
    data = FakeData(
        results=[result("alpha", 10)],
        stints=[
            StintRecord(
                driver_number=10,
                stint_number=1,
                compound=Compound.UNKNOWN,
                lap_start=20,
                lap_end=5,
                tyre_age_at_start=None,
            )
        ],
    )

    report = services.ingest_session(session, fake_sources(data))

    stint = Stint.objects.get()
    assert stint.lap_end is None
    assert stint.compound == "UNKNOWN"
    assert any("lap_end < lap_start" in s for s in report.skipped)


def test_duplicate_weather_and_pit_rows_are_collapsed() -> None:
    session = SessionFactory.create()
    sample = WeatherRecord(
        sampled_at=T0,
        air_temperature_c=25,
        track_temperature_c=40,
        humidity_pct=None,
        pressure_mbar=None,
        rainfall=False,
        wind_speed_ms=None,
        wind_direction_deg=None,
    )
    pit = PitRecord(
        driver_number=10,
        lap_number=2,
        occurred_at=T0,
        pit_lane_duration_s=22.0,
        stationary_duration_s=None,
    )
    data = FakeData(
        results=[result("alpha", 10)],
        weather=[sample, sample],
        pits=[pit, pit],
        jolpica_pits=[
            JolpicaPitStop(
                driver_id="unknown", stop_number=1, lap_number=2, duration_s=21.0, local_time=""
            )
        ],
        laps=[lap(10, 1), lap(10, 2)],
    )

    services.ingest_session(session, fake_sources(data))

    stop = PitStop.objects.get()
    assert stop.reported_duration_s is None  # Jolpica row for an unknown driver is ignored
    assert Lap.objects.get(lap_number=2).is_pit_in_lap


def test_non_race_or_unlinked_sessions_are_skipped() -> None:
    quali = SessionFactory.create(kind=SessionKind.QUALIFYING)
    unlinked = SessionFactory.create(openf1_session_key=None)

    for session in (quali, unlinked):
        report = services.ingest_session(session, fake_sources(FakeData()))
        assert report.counts == {}
        assert report.skipped


def test_is_ingestable_requires_a_finished_linked_race() -> None:
    finished = SessionFactory.create()
    running = SessionFactory.create(ends_at=None)
    later = dt.datetime(2030, 1, 1, tzinfo=dt.UTC)

    assert services.is_ingestable(finished, now=later)
    assert not services.is_ingestable(finished, now=T0)
    assert not services.is_ingestable(running, now=later)


def test_calendar_without_timing_match_keeps_sessions_unlinked() -> None:
    event = EventInfo(
        season=2026,
        round=1,
        name="Future Grand Prix",
        race_date=dt.date(2026, 3, 8),
        format=EventFormat.SPRINT,
        circuit=CircuitInfo(
            circuit_id="albert_park", name="Albert Park", locality="Melbourne", country="Australia"
        ),
        sessions=(
            ScheduledSession(kind=SourceKind.SPRINT, starts_at=None),
            ScheduledSession(
                kind=SourceKind.RACE, starts_at=dt.datetime(2026, 3, 8, 4, tzinfo=dt.UTC)
            ),
        ),
    )

    services.ingest_calendar(2026, fake_sources(FakeData(events=[event])))

    sessions = Session.objects.filter(event__season__year=2026)
    assert sessions.count() == 2
    assert not sessions.filter(openf1_session_key__isnull=False).exists()
    assert sessions.get(kind=SessionKind.RACE).event.format == "sprint"


def _samples(count: int) -> list[PositionSample]:
    return [PositionSample(at=T0 + dt.timedelta(seconds=i / 4), x=i, y=-i) for i in range(count)]


def test_track_outline_is_stored_from_the_fastest_clean_lap() -> None:
    session = SessionFactory.create()
    data = FakeData(
        results=[result("alpha", 10)],
        laps=[lap(10, 1, 80.0), lap(10, 2, 91.0), lap(10, 3, 89.5)],
        locations=_samples(300),
    )

    report = services.ingest_session(session, fake_sources(data))

    outline = TrackOutline.objects.get(session=session)
    assert (outline.lap_number, outline.lap_time_s) == (3, 89.5)
    assert outline.points[1] == [1.0, -1.0]
    assert report.counts["track_outline"] == 1


def test_track_outline_is_skipped_when_the_trace_is_too_short() -> None:
    session = SessionFactory.create()
    data = FakeData(results=[result("alpha", 10)], laps=[lap(10, 2)], locations=_samples(20))

    report = services.ingest_session(session, fake_sources(data))

    assert not TrackOutline.objects.exists()
    assert any("only 20 samples" in s for s in report.skipped)


def test_track_outline_is_skipped_without_a_clean_lap() -> None:
    session = SessionFactory.create()
    data = FakeData(results=[result("alpha", 10)], laps=[lap(10, 1)])

    report = services.ingest_session(session, fake_sources(data))

    assert not TrackOutline.objects.exists()
    assert "track outline: no clean reference lap" in report.skipped


def test_track_outline_failure_does_not_block_timing_data() -> None:
    session = SessionFactory.create()

    class Unavailable(FakeSource):
        def locations(
            self, session_key: int, driver_number: int, start: dt.datetime, end: dt.datetime
        ) -> list[PositionSample]:
            raise UpstreamUnavailableError("openf1", "down")

    source = Unavailable(FakeData(results=[result("alpha", 10)], laps=[lap(10, 2)]))
    sources = Sources(schedule=source, results=source, timing=source, clients=())

    report = services.ingest_session(session, sources)

    assert Lap.objects.count() == 1
    assert not TrackOutline.objects.exists()
    assert "track outline: UpstreamUnavailableError" in report.skipped
