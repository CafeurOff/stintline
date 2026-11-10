"""Capability protocols. A source implements only what it provides (interface
segregation): ingestion composes a schedule source, a results source and a timing source.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from racedata.models import (
    CarSample,
    CircuitInfo,
    ConstructorInfo,
    DriverEntry,
    DriverInfo,
    EventInfo,
    JolpicaPitStop,
    LapRecord,
    PitRecord,
    PositionSample,
    QualifyingRecord,
    RaceControlRecord,
    ResultRecord,
    SessionKind,
    StandingRecord,
    StintRecord,
    TeamRadioRecord,
    TimingSession,
    WeatherRecord,
    WikiPortrait,
)


class ScheduleSource(Protocol):
    def season_events(self, season: int) -> list[EventInfo]: ...


class ResultsSource(Protocol):
    def results(self, season: int, round_: int, kind: SessionKind) -> list[ResultRecord]: ...

    def pit_stops(self, season: int, round_: int) -> list[JolpicaPitStop]: ...


class TimingSource(Protocol):
    def sessions(self, year: int, kind: SessionKind | None = None) -> list[TimingSession]: ...

    def drivers(self, session_key: int) -> list[DriverEntry]: ...

    def laps(self, session_key: int) -> list[LapRecord]: ...

    def stints(self, session_key: int) -> list[StintRecord]: ...

    def pit(self, session_key: int) -> list[PitRecord]: ...

    def race_control(self, session_key: int) -> list[RaceControlRecord]: ...

    def weather(self, session_key: int) -> list[WeatherRecord]: ...

    def locations(
        self, session_key: int, driver_number: int, start: datetime, end: datetime
    ) -> list[PositionSample]: ...

    def team_radio(self, session_key: int) -> list[TeamRadioRecord]: ...

    def car_data(
        self, session_key: int, driver_number: int, start: datetime, end: datetime
    ) -> list[CarSample]: ...


class HistorySource(Protocol):
    """Season-wide results and reference data back to 1950 (Jolpica)."""

    def season_events(self, season: int) -> list[EventInfo]: ...

    def season_results(self, season: int, kind: SessionKind) -> dict[int, list[ResultRecord]]: ...

    def season_qualifying(self, season: int) -> dict[int, list[QualifyingRecord]]: ...

    def standings(
        self, season: int, round_: int | None, constructors: bool
    ) -> list[StandingRecord]: ...

    def drivers(self) -> list[DriverInfo]: ...

    def constructors(self) -> list[ConstructorInfo]: ...

    def circuits(self) -> list[CircuitInfo]: ...


class PortraitSource(Protocol):
    """Freely licensed portraits keyed by Wikipedia article title (ADR 0009)."""

    def portraits(self, titles: Sequence[str]) -> dict[str, WikiPortrait]: ...
