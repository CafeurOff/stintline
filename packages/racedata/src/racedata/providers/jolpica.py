"""Jolpica adapter (Ergast-compatible API). Calendar, classifications and pit stops."""

from __future__ import annotations

from collections.abc import Callable
from functools import partial
from typing import Any

import structlog

from racedata.errors import InvalidPayloadError
from racedata.http import HttpClient
from racedata.models import (
    CircuitInfo,
    ConstructorInfo,
    DriverInfo,
    EventFormat,
    EventInfo,
    JolpicaPitStop,
    QualifyingRecord,
    ResultRecord,
    ScheduledSession,
    SessionKind,
    StandingRecord,
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

    def _list(self, path: str, table: str, key: str) -> list[dict[str, Any]]:
        """Fetch every page of a flat table (``DriverTable.Drivers``…)."""
        rows: list[dict[str, Any]] = []
        offset = 0
        while True:
            params: dict[str, str | int] = {"limit": PAGE_SIZE}
            if offset:
                params["offset"] = offset
            data = self._client.get_json(path, params)
            try:
                mr = data["MRData"]
                rows.extend(mr[table][key])
                total = int(mr["total"])
            except (KeyError, TypeError, ValueError) as exc:
                raise InvalidPayloadError(PROVIDER, f"{path}: unexpected payload shape") from exc
            offset += PAGE_SIZE
            if offset >= total:
                return rows

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

    def season_results(self, season: int, kind: SessionKind) -> dict[int, list[ResultRecord]]:
        """Every race (or sprint) classification of a season in one paginated call."""
        endpoint, key = (
            ("results", "Results") if kind is SessionKind.RACE else ("sprint", "SprintResults")
        )
        races = self._table(f"{season}/{endpoint}", "RaceTable", key)
        return {int(r["round"]): _rows(r.get(key, []), _result) for r in races}

    def season_qualifying(self, season: int) -> dict[int, list[QualifyingRecord]]:
        races = self._table(f"{season}/qualifying", "RaceTable", "QualifyingResults")
        return {int(r["round"]): _rows(r.get("QualifyingResults", []), _qualifying) for r in races}

    def standings(
        self, season: int, round_: int | None, constructors: bool
    ) -> list[StandingRecord]:
        """Championship table after ``round_`` (``None`` = latest round of the season)."""
        table = "constructorstandings" if constructors else "driverstandings"
        path = f"{season}/{round_}/{table}" if round_ else f"{season}/{table}"
        lists = self._list(path, "StandingsTable", "StandingsLists")
        key = "ConstructorStandings" if constructors else "DriverStandings"
        out: list[StandingRecord] = []
        for standing_list in lists:
            out.extend(
                _rows(
                    standing_list.get(key, []),
                    partial(_standing, standing_list, constructors=constructors),
                )
            )
        return out

    def drivers(self) -> list[DriverInfo]:
        return _rows(self._list("drivers", "DriverTable", "Drivers"), _driver_info)

    def constructors(self) -> list[ConstructorInfo]:
        return _rows(
            self._list("constructors", "ConstructorTable", "Constructors"), _constructor_info
        )

    def circuits(self) -> list[CircuitInfo]:
        return _rows(self._list("circuits", "CircuitTable", "Circuits"), _circuit)

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
            circuit=_circuit(circuit),
            sessions=tuple(sessions),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed race entry: {exc}") from exc


def _rows[T](rows: list[dict[str, Any]], parse: Callable[[dict[str, Any]], T]) -> list[T]:
    """Parse rows; a malformed row is skipped and logged (old seasons have odd entries)."""
    out: list[T] = []
    for row in rows:
        try:
            out.append(parse(row))
        except InvalidPayloadError as exc:
            log.warning("jolpica_row_skipped", error=str(exc))
    return out


def _circuit(c: dict[str, Any]) -> CircuitInfo:
    try:
        location = c["Location"]
        return CircuitInfo(
            circuit_id=str(c["circuitId"]),
            name=str(c["circuitName"]),
            locality=str(location["locality"]),
            country=str(location["country"]),
            latitude=optional_float(location.get("lat")),
            longitude=optional_float(location.get("long")),
            url=c.get("url") or None,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed circuit: {exc}") from exc


def _driver_info(d: dict[str, Any]) -> DriverInfo:
    try:
        return DriverInfo(
            driver_id=str(d["driverId"]),
            code=d.get("code") or None,
            permanent_number=optional_int(d.get("permanentNumber")),
            given_name=str(d["givenName"]),
            family_name=str(d["familyName"]),
            date_of_birth=parse_date(PROVIDER, d["dateOfBirth"]) if d.get("dateOfBirth") else None,
            nationality=d.get("nationality") or None,
            url=d.get("url") or None,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed driver: {exc}") from exc


def _constructor_info(c: dict[str, Any]) -> ConstructorInfo:
    try:
        return ConstructorInfo(
            constructor_id=str(c["constructorId"]),
            name=str(c["name"]),
            nationality=c.get("nationality") or None,
            url=c.get("url") or None,
        )
    except (KeyError, TypeError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed constructor: {exc}") from exc


def _qualifying(r: dict[str, Any]) -> QualifyingRecord:
    try:
        driver, constructor = r["Driver"], r["Constructor"]
        return QualifyingRecord(
            driver_id=str(driver["driverId"]),
            code=driver.get("code"),
            given_name=str(driver["givenName"]),
            family_name=str(driver["familyName"]),
            car_number=int(r["number"]),
            constructor_id=str(constructor["constructorId"]),
            constructor_name=str(constructor["name"]),
            position=optional_int(r.get("position")),
            q1_s=parse_duration_s(r.get("Q1")),
            q2_s=parse_duration_s(r.get("Q2")),
            q3_s=parse_duration_s(r.get("Q3")),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed qualifying row: {exc}") from exc


def _standing(
    standing_list: dict[str, Any], r: dict[str, Any], constructors: bool
) -> StandingRecord:
    try:
        competitor = r["Constructor"]["constructorId"] if constructors else r["Driver"]["driverId"]
        return StandingRecord(
            season=int(standing_list["season"]),
            round=int(standing_list["round"]),
            competitor_id=str(competitor),
            position=optional_int(r.get("position")),
            position_text=str(r.get("positionText", "")),
            points=optional_float(r.get("points")) or 0.0,
            wins=optional_int(r.get("wins")) or 0,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise InvalidPayloadError(PROVIDER, f"malformed standing row: {exc}") from exc


def _result(r: dict[str, Any]) -> ResultRecord:
    try:
        driver, constructor = r["Driver"], r["Constructor"]
        fastest = r.get("FastestLap") or {}
        millis = optional_int((r.get("Time") or {}).get("millis"))
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
            nationality=driver.get("nationality") or None,
            date_of_birth=(
                parse_date(PROVIDER, driver["dateOfBirth"]) if driver.get("dateOfBirth") else None
            ),
            permanent_number=optional_int(driver.get("permanentNumber")),
            driver_url=driver.get("url") or None,
            constructor_nationality=constructor.get("nationality") or None,
            constructor_url=constructor.get("url") or None,
            race_time_s=millis / 1000 if millis else None,
            fastest_lap_rank=optional_int(fastest.get("rank")),
            fastest_lap_s=parse_duration_s((fastest.get("Time") or {}).get("time")),
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
