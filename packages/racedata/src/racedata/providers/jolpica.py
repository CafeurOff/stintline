"""Jolpica adapter (Ergast-compatible API). Calendar, classifications and pit stops."""

from __future__ import annotations

from typing import Any

import structlog

from racedata.errors import InvalidPayloadError
from racedata.http import HttpClient
from racedata.models import (
    CircuitInfo,
    EventFormat,
    EventInfo,
    JolpicaPitStop,
    ResultRecord,
    ScheduledSession,
    SessionKind,
)
from racedata.parsing import (
    optional_float,
    optional_int,
    parse_date,
    parse_duration_s,
    parse_utc_date_time,
)

PROVIDER = "jolpica"
PAGE_SIZE = 100
"""Jolpica's maximum page size."""

log = structlog.get_logger(__name__)

SCHEDULE_KEYS: tuple[tuple[str, SessionKind], ...] = (
    ("FirstPractice", SessionKind.PRACTICE_1),
    ("SecondPractice", SessionKind.PRACTICE_2),
    ("ThirdPractice", SessionKind.PRACTICE_3),
    ("SprintQualifying", SessionKind.SPRINT_QUALIFYING),
    ("SprintShootout", SessionKind.SPRINT_QUALIFYING),
    ("Sprint", SessionKind.SPRINT),
    ("Qualifying", SessionKind.QUALIFYING),
)


class JolpicaSource:
    """Implements :class:`ScheduleSource` and :class:`ResultsSource`."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def _table(self, path: str, table: str, rows_key: str) -> list[dict[str, Any]]:
        """Fetch every page of ``MRData.<table>.Races`` and concatenate the races."""
        races: list[dict[str, Any]] = []
        offset = 0
        while True:
            params: dict[str, str | int] = {"limit": PAGE_SIZE}
            if offset:
                params["offset"] = offset
            data = self._client.get_json(path, params)
            try:
                mr = data["MRData"]
                page = mr[table]["Races"]
                total = int(mr["total"])
            except (KeyError, TypeError, ValueError) as exc:
                raise InvalidPayloadError(PROVIDER, f"{path}: unexpected payload shape") from exc
            _merge_pages(races, page, rows_key)
            offset += PAGE_SIZE
            if offset >= total:
                return races

    def season_events(self, season: int) -> list[EventInfo]:
        return [_event(r) for r in self._table(f"{season}/races", "RaceTable", "")]

    def results(self, season: int, round_: int, kind: SessionKind) -> list[ResultRecord]:
        if kind not in (SessionKind.RACE, SessionKind.SPRINT):
            return []
        endpoint, key = (
            ("results", "Results") if kind is SessionKind.RACE else ("sprint", "SprintResults")
        )
        races = self._table(f"{season}/{round_}/{endpoint}", "RaceTable", key)
        rows = races[0].get(key, []) if races else []
        return [_result(r) for r in rows]

    def pit_stops(self, season: int, round_: int) -> list[JolpicaPitStop]:
        races = self._table(f"{season}/{round_}/pitstops", "RaceTable", "PitStops")
        rows = races[0].get("PitStops", []) if races else []
        return [_pit_stop(r) for r in rows]


def _merge_pages(races: list[dict[str, Any]], page: list[dict[str, Any]], rows_key: str) -> None:
    """Paginated Ergast responses repeat the race object with the next slice of rows."""
    for race in page:
        if rows_key and races and races[-1].get("round") == race.get("round"):
            races[-1][rows_key] = [*races[-1].get(rows_key, []), *race.get(rows_key, [])]
        else:
            races.append(race)


def _event(r: dict[str, Any]) -> EventInfo:
    try:
        sessions = [
            ScheduledSession(
                kind=kind,
                starts_at=parse_utc_date_time(PROVIDER, r[key]["date"], r[key].get("time")),
            )
            for key, kind in SCHEDULE_KEYS
            if key in r
        ]
        sessions.append(
            ScheduledSession(
                kind=SessionKind.RACE,
                starts_at=parse_utc_date_time(PROVIDER, r["date"], r.get("time")),
            )
        )
        circuit = r["Circuit"]
        return EventInfo(
            season=int(r["season"]),
            round=int(r["round"]),
            name=str(r["raceName"]),
            race_date=parse_date(PROVIDER, r["date"]),
            format=EventFormat.SPRINT if "Sprint" in r else EventFormat.CONVENTIONAL,
            circuit=CircuitInfo(
                circuit_id=str(circuit["circuitId"]),
                name=str(circuit["circuitName"]),
                locality=str(circuit["Location"]["locality"]),
                country=str(circuit["Location"]["country"]),
            ),
            sessions=tuple(sessions),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed race entry: {exc}") from exc


def _result(r: dict[str, Any]) -> ResultRecord:
    try:
        driver, constructor = r["Driver"], r["Constructor"]
        return ResultRecord(
            driver_id=str(driver["driverId"]),
            code=driver.get("code"),
            given_name=str(driver["givenName"]),
            family_name=str(driver["familyName"]),
            car_number=int(r["number"]),
            constructor_id=str(constructor["constructorId"]),
            constructor_name=str(constructor["name"]),
            grid=optional_int(r.get("grid")) or None,  # grid 0 means pit-lane start
            position=optional_int(r.get("position")),
            position_text=str(r.get("positionText", "")),
            status=str(r.get("status", "")),
            points=optional_float(r.get("points")) or 0.0,
            laps_completed=optional_int(r.get("laps")) or 0,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed result row: {exc}") from exc


def _pit_stop(r: dict[str, Any]) -> JolpicaPitStop:
    try:
        return JolpicaPitStop(
            driver_id=str(r["driverId"]),
            stop_number=int(r["stop"]),
            lap_number=int(r["lap"]),
            duration_s=parse_duration_s(r.get("duration")),
            local_time=str(r.get("time", "")),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed pit stop row: {exc}") from exc
