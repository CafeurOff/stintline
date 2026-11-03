"""OpenF1 adapter (https://openf1.org). Historical endpoints, free tier, no auth."""

from __future__ import annotations

import re
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any, TypeVar

import structlog

from racedata.errors import InvalidPayloadError, NotFoundError
from racedata.http import HttpClient
from racedata.models import (
    Compound,
    DriverEntry,
    LapRecord,
    PitRecord,
    PositionSample,
    RaceControlRecord,
    SessionKind,
    StintRecord,
    TeamRadioRecord,
    TimingSession,
    WeatherRecord,
)
from racedata.parsing import optional_float, optional_int, parse_datetime, parse_optional_datetime

PROVIDER = "openf1"
log = structlog.get_logger(__name__)

T = TypeVar("T")

SESSION_NAMES: dict[str, SessionKind] = {
    "Practice 1": SessionKind.PRACTICE_1,
    "Practice 2": SessionKind.PRACTICE_2,
    "Practice 3": SessionKind.PRACTICE_3,
    "Sprint Qualifying": SessionKind.SPRINT_QUALIFYING,
    "Sprint Shootout": SessionKind.SPRINT_QUALIFYING,
    "Sprint": SessionKind.SPRINT,
    "Qualifying": SessionKind.QUALIFYING,
    "Race": SessionKind.RACE,
}
KIND_TO_NAME = {
    SessionKind.PRACTICE_1: "Practice 1",
    SessionKind.PRACTICE_2: "Practice 2",
    SessionKind.PRACTICE_3: "Practice 3",
    SessionKind.SPRINT_QUALIFYING: "Sprint Qualifying",
    SessionKind.SPRINT: "Sprint",
    SessionKind.QUALIFYING: "Qualifying",
    SessionKind.RACE: "Race",
}


class OpenF1Source:
    """Implements :class:`racedata.providers.base.TimingSource`."""

    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def _rows(self, endpoint: str, params: dict[str, str | int]) -> list[dict[str, Any]]:
        try:
            data = self._client.get_json(endpoint, params)
        except NotFoundError:
            # OpenF1 answers an empty result set with HTTP 404 {"detail": "No results found."}
            # (e.g. `pit` for a sprint without stops). That is data, not a failure.
            log.info("openf1_empty_result", endpoint=endpoint)
            return []
        if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
            raise InvalidPayloadError(PROVIDER, f"{endpoint}: expected a list of objects")
        return data

    def _parse_all(
        self, endpoint: str, rows: list[dict[str, Any]], parse: Callable[[dict[str, Any]], T]
    ) -> list[T]:
        """Parse every row. Malformed rows are skipped and logged, never silently kept."""
        out: list[T] = []
        for row in rows:
            try:
                out.append(parse(row))
            except (KeyError, TypeError, ValueError, InvalidPayloadError) as exc:
                log.warning("openf1_row_skipped", endpoint=endpoint, error=str(exc))
        return out

    def sessions(self, year: int, kind: SessionKind | None = None) -> list[TimingSession]:
        params: dict[str, str | int] = {"year": year}
        if kind is not None:
            params["session_name"] = KIND_TO_NAME[kind]
        rows = [
            r
            for r in self._rows("sessions", params)
            if r.get("session_name") in SESSION_NAMES and not r.get("is_cancelled")
        ]
        return self._parse_all("sessions", rows, _session)

    def drivers(self, session_key: int) -> list[DriverEntry]:
        return self._parse_all(
            "drivers", self._rows("drivers", {"session_key": session_key}), _driver
        )

    def laps(self, session_key: int) -> list[LapRecord]:
        return self._parse_all("laps", self._rows("laps", {"session_key": session_key}), _lap)

    def stints(self, session_key: int) -> list[StintRecord]:
        return self._parse_all("stints", self._rows("stints", {"session_key": session_key}), _stint)

    def pit(self, session_key: int) -> list[PitRecord]:
        return self._parse_all("pit", self._rows("pit", {"session_key": session_key}), _pit)

    def race_control(self, session_key: int) -> list[RaceControlRecord]:
        rows = self._rows("race_control", {"session_key": session_key})
        return self._parse_all("race_control", rows, _race_control)

    def weather(self, session_key: int) -> list[WeatherRecord]:
        rows = self._rows("weather", {"session_key": session_key})
        return self._parse_all("weather", rows, _weather)

    def team_radio(self, session_key: int) -> list[TeamRadioRecord]:
        rows = self._rows("team_radio", {"session_key": session_key})
        return sorted(self._parse_all("team_radio", rows, _team_radio), key=lambda r: r.recorded_at)

    def locations(
        self, session_key: int, driver_number: int, start: datetime, end: datetime
    ) -> list[PositionSample]:
        """Positions of one car in ``[start, end)``. Always bounded: a whole race for one
        car is tens of thousands of rows, far beyond what any view needs."""
        params: dict[str, str | int] = {
            "session_key": session_key,
            "driver_number": driver_number,
            "date>": _openf1_instant(start),
            "date<": _openf1_instant(end),
        }
        rows = self._rows("location", params)
        samples = self._parse_all("location", rows, _location)
        return sorted(samples, key=lambda s: s.at)


def _team_radio(r: dict[str, Any]) -> TeamRadioRecord:
    url = r.get("recording_url")
    if not isinstance(url, str) or not url.startswith("https://"):
        raise InvalidPayloadError(PROVIDER, "team radio without an https recording_url")
    return TeamRadioRecord(
        driver_number=int(r["driver_number"]),
        recorded_at=parse_datetime(PROVIDER, r["date"]),
        url=url,
    )


def _openf1_instant(value: datetime) -> str:
    """UTC instant with milliseconds, as OpenF1 filters expect (``2025-08-03T13:15:37.303``)."""
    if value.tzinfo is None:
        raise ValueError("expected an aware datetime")
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]


def _location(r: dict[str, Any]) -> PositionSample:
    return PositionSample(at=parse_datetime(PROVIDER, r["date"]), x=float(r["x"]), y=float(r["y"]))


def _session(r: dict[str, Any]) -> TimingSession:
    return TimingSession(
        session_key=int(r["session_key"]),
        meeting_key=int(r["meeting_key"]),
        kind=SESSION_NAMES[r["session_name"]],
        name=str(r["session_name"]),
        starts_at=parse_datetime(PROVIDER, r["date_start"]),
        ends_at=parse_optional_datetime(PROVIDER, r.get("date_end")),
        circuit_key=optional_int(r.get("circuit_key")),
        circuit_short_name=r.get("circuit_short_name"),
        country_name=r.get("country_name"),
        year=int(r["year"]),
    )


_MEDIA_ID = re.compile(r"/drivers/[A-Z]/([A-Z]{6}\d{2})_", re.IGNORECASE)


def media_id_from_headshot(url: Any) -> str | None:
    """``.../drivers/L/LANNOR01_Lando_Norris/...`` -> ``"lannor01"``."""
    if not isinstance(url, str):
        return None
    match = _MEDIA_ID.search(url)
    return match.group(1).lower() if match else None


def _driver(r: dict[str, Any]) -> DriverEntry:
    colour = r.get("team_colour")
    return DriverEntry(
        driver_number=int(r["driver_number"]),
        acronym=r.get("name_acronym"),
        first_name=r.get("first_name"),
        last_name=r.get("last_name"),
        team_name=r.get("team_name"),
        team_colour=colour.upper().lstrip("#") if isinstance(colour, str) and colour else None,
        media_id=media_id_from_headshot(r.get("headshot_url")),
    )


def _lap(r: dict[str, Any]) -> LapRecord:
    return LapRecord(
        driver_number=int(r["driver_number"]),
        lap_number=int(r["lap_number"]),
        lap_time_s=optional_float(r.get("lap_duration")),
        sector_1_s=optional_float(r.get("duration_sector_1")),
        sector_2_s=optional_float(r.get("duration_sector_2")),
        sector_3_s=optional_float(r.get("duration_sector_3")),
        is_pit_out_lap=bool(r.get("is_pit_out_lap")),
        started_at=parse_optional_datetime(PROVIDER, r.get("date_start")),
        speed_trap_kph=optional_int(r.get("st_speed")),
    )


def _stint(r: dict[str, Any]) -> StintRecord:
    return StintRecord(
        driver_number=int(r["driver_number"]),
        stint_number=int(r["stint_number"]),
        compound=Compound.parse(r.get("compound")),
        lap_start=optional_int(r.get("lap_start")),
        lap_end=optional_int(r.get("lap_end")),
        tyre_age_at_start=optional_int(r.get("tyre_age_at_start")),
    )


def _pit(r: dict[str, Any]) -> PitRecord:
    lane = r.get("lane_duration", r.get("pit_duration"))
    return PitRecord(
        driver_number=int(r["driver_number"]),
        lap_number=int(r["lap_number"]),
        occurred_at=parse_datetime(PROVIDER, r["date"]),
        pit_lane_duration_s=optional_float(lane),
        stationary_duration_s=optional_float(r.get("stop_duration")),
    )


def _race_control(r: dict[str, Any]) -> RaceControlRecord:
    return RaceControlRecord(
        occurred_at=parse_datetime(PROVIDER, r["date"]),
        lap_number=optional_int(r.get("lap_number")),
        category=str(r.get("category") or "Other"),
        flag=r.get("flag") or None,
        scope=r.get("scope") or None,
        sector=optional_int(r.get("sector")),
        driver_number=optional_int(r.get("driver_number")),
        message=str(r.get("message") or ""),
    )


def _weather(r: dict[str, Any]) -> WeatherRecord:
    return WeatherRecord(
        sampled_at=parse_datetime(PROVIDER, r["date"]),
        air_temperature_c=optional_float(r.get("air_temperature")),
        track_temperature_c=optional_float(r.get("track_temperature")),
        humidity_pct=optional_float(r.get("humidity")),
        pressure_mbar=optional_float(r.get("pressure")),
        rainfall=bool(r.get("rainfall")),
        wind_speed_ms=optional_float(r.get("wind_speed")),
        wind_direction_deg=optional_int(r.get("wind_direction")),
    )
