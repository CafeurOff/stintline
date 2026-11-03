"""Capability protocols. A source implements only what it provides (interface
segregation): ingestion composes a schedule source, a results source and a timing source.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from racedata.models import (
    DriverEntry,
    EventInfo,
    JolpicaPitStop,
    LapRecord,
    PitRecord,
    PositionSample,
    RaceControlRecord,
    ResultRecord,
    SessionKind,
    StintRecord,
    TimingSession,
    WeatherRecord,
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
