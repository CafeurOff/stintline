"""A provider-neutral view of the live session, derived from the merged topic state.

Only what the UI and the live strategy need: who is where, on which tyres, how far into
the lap, plus track status, race control, team radio and weather. Datetimes are UTC.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from racedata.live.merge import LiveState
from racedata.models import _DTO

STATIC_BASE = "https://livetiming.formula1.com/static/"
"""Team radio recordings live under the session path. Referenced, never downloaded."""
RACE_CONTROL_KEPT = 20
TEAM_RADIO_KEPT = 30
TRACK_STATUS = {
    "1": "clear",
    "2": "yellow",
    "4": "safety_car",
    "5": "red",
    "6": "virtual_safety_car",
    "7": "vsc_ending",
}
_LAP_TIME = re.compile(r"^(?:(\d+):)?(\d+(?:\.\d+)?)$")
_OFFSET = re.compile(r"^([+-]?)(\d{1,2}):(\d{2})(?::(\d{2}))?$")


class LiveSession(_DTO):
    key: int | None
    meeting: str
    name: str
    type: str
    circuit_key: int | None
    circuit: str
    country: str
    status: str
    starts_at: datetime | None


class LiveCar(_DTO):
    number: int
    code: str
    first_name: str
    last_name: str
    team: str
    colour: str
    position: int | None
    gap_s: float | None
    """Seconds behind the leader, ``None`` for the leader or a lapped car."""
    laps_behind: int
    interval_s: float | None
    laps: int
    in_pit: bool
    pit_out: bool
    retired: bool
    stopped: bool
    pit_stops: int
    last_lap_s: float | None
    best_lap_s: float | None
    compound: str | None
    tyre_age: int | None
    tyre_new: bool | None
    lap_progress: float
    """Share of the current lap completed, from the mini-sectors passed (0 to 1)."""


class RaceControl(_DTO):
    at: datetime | None
    category: str
    flag: str
    message: str
    lap: int | None


class Radio(_DTO):
    at: datetime | None
    number: int
    url: str


class Weather(_DTO):
    air_c: float | None
    track_c: float | None
    humidity_pct: float | None
    rain: bool
    wind_ms: float | None


class LiveView(_DTO):
    session: LiveSession
    lap: int | None
    total_laps: int | None
    track_status: str
    remaining: str | None
    cars: list[LiveCar]
    race_control: list[RaceControl]
    team_radio: list[Radio]
    weather: Weather | None


def lap_seconds(text: Any) -> float | None:
    """``"1:19.674"`` -> 79.674; empty or malformed -> ``None``."""
    match = _LAP_TIME.match(str(text or "").strip())
    if not match:
        return None
    minutes = int(match.group(1) or 0)
    return round(minutes * 60 + float(match.group(2)), 3)


def gap(text: Any) -> tuple[float | None, int]:
    """``"+0.799"`` -> (0.799, 0); ``"1L"`` / ``"2 LAPS"`` -> (None, laps); leader -> (None, 0)."""
    raw = str(text or "").strip().upper()
    laps = re.match(r"^\+?(\d+)\s*L", raw)
    if laps:
        return None, int(laps.group(1))
    try:
        return float(raw.lstrip("+")), 0
    except ValueError:
        return None, 0


def _utc(text: Any) -> datetime | None:
    try:
        value = datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def session_start(info: dict[str, Any]) -> datetime | None:
    """``StartDate`` is circuit-local, ``GmtOffset`` gives the offset: convert to UTC."""
    try:
        local = datetime.fromisoformat(str(info.get("StartDate", "")))
    except ValueError:
        return None
    match = _OFFSET.match(str(info.get("GmtOffset", "")))
    if not match:
        return None
    sign = -1 if match.group(1) == "-" else 1
    offset = timedelta(hours=int(match.group(2)), minutes=int(match.group(3)))
    return (local - sign * offset).replace(tzinfo=UTC)


def _int(value: Any) -> int | None:
    try:
        return int(str(value))
    except ValueError:
        return None


def _float(value: Any) -> float | None:
    try:
        return float(str(value))
    except ValueError:
        return None


def _progress(line: dict[str, Any]) -> float:
    done = total = 0
    sectors = line.get("Sectors") or []
    for sector in sectors if isinstance(sectors, list) else []:
        segments = (sector or {}).get("Segments") or []
        for segment in segments if isinstance(segments, list) else []:
            total += 1
            done += bool((segment or {}).get("Status"))
    return round(done / total, 3) if total else 0.0


def _tyres(app: dict[str, Any]) -> tuple[str | None, int | None, bool | None]:
    stints = app.get("Stints") or []
    if not isinstance(stints, list) or not stints:
        return None, None, None
    stint = stints[-1] or {}
    start, run = _int(stint.get("StartLaps")), _int(stint.get("TotalLaps"))
    age = None if start is None and run is None else (start or 0) + (run or 0)
    new = stint.get("New")
    return stint.get("Compound"), age, None if new is None else str(new).lower() == "true"


def _car(number: str, line: dict[str, Any], driver: dict[str, Any], app: dict[str, Any]) -> LiveCar:
    gap_s, laps_behind = gap(line.get("GapToLeader"))
    interval = line.get("IntervalToPositionAhead") or {}
    compound, age, new = _tyres(app)
    return LiveCar(
        number=int(number),
        code=str(driver.get("Tla") or number),
        first_name=str(driver.get("FirstName") or ""),
        last_name=str(driver.get("LastName") or ""),
        team=str(driver.get("TeamName") or ""),
        colour=str(driver.get("TeamColour") or ""),
        position=_int(line.get("Position")),
        gap_s=gap_s,
        laps_behind=laps_behind,
        interval_s=gap(interval.get("Value") if isinstance(interval, dict) else None)[0],
        laps=_int(line.get("NumberOfLaps")) or 0,
        in_pit=bool(line.get("InPit")),
        pit_out=bool(line.get("PitOut")),
        retired=bool(line.get("Retired")),
        stopped=bool(line.get("Stopped")),
        pit_stops=_int(line.get("NumberOfPitStops")) or 0,
        last_lap_s=lap_seconds((line.get("LastLapTime") or {}).get("Value")),
        best_lap_s=lap_seconds((line.get("BestLapTime") or {}).get("Value")),
        compound=compound,
        tyre_age=age,
        tyre_new=new,
        lap_progress=_progress(line),
    )


def view(state: LiveState) -> LiveView:
    info = state.get("SessionInfo")
    meeting = info.get("Meeting") or {}
    lines = state.get("TimingData").get("Lines") or {}
    apps = state.get("TimingAppData").get("Lines") or {}
    drivers = state.get("DriverList")
    cars = [
        _car(number, line, drivers.get(number) or {}, apps.get(number) or {})
        for number, line in lines.items()
        if number.isdigit() and isinstance(line, dict)
    ]
    cars.sort(key=lambda c: (c.position is None, c.position or 0, c.number))
    lap_count = state.get("LapCount")
    messages = state.get("RaceControlMessages").get("Messages") or []
    captures = state.get("TeamRadio").get("Captures") or []
    weather = state.get("WeatherData")
    path = str(info.get("Path") or "")
    return LiveView(
        session=LiveSession(
            key=_int(info.get("Key")),
            meeting=str(meeting.get("Name") or ""),
            name=str(info.get("Name") or ""),
            type=str(info.get("Type") or ""),
            circuit_key=_int((meeting.get("Circuit") or {}).get("Key")),
            circuit=str((meeting.get("Circuit") or {}).get("ShortName") or ""),
            country=str((meeting.get("Country") or {}).get("Name") or ""),
            status=str(state.get("SessionStatus").get("Status") or info.get("SessionStatus") or ""),
            starts_at=session_start(info),
        ),
        lap=_int(lap_count.get("CurrentLap")),
        total_laps=_int(lap_count.get("TotalLaps")),
        track_status=TRACK_STATUS.get(str(state.get("TrackStatus").get("Status")), "clear"),
        remaining=state.get("ExtrapolatedClock").get("Remaining"),
        cars=cars,
        race_control=[
            RaceControl(
                at=_utc(m.get("Utc")),
                category=str(m.get("Category") or ""),
                flag=str(m.get("Flag") or ""),
                message=str(m.get("Message") or ""),
                lap=_int(m.get("Lap")),
            )
            for m in (messages if isinstance(messages, list) else [])[-RACE_CONTROL_KEPT:]
            if isinstance(m, dict)
        ][::-1],
        team_radio=[
            Radio(
                at=_utc(c.get("Utc")),
                number=_int(c.get("RacingNumber")) or 0,
                url=f"{STATIC_BASE}{path}{c.get('Path')}",
            )
            for c in (captures if isinstance(captures, list) else [])[-TEAM_RADIO_KEPT:]
            if isinstance(c, dict) and c.get("Path") and path
        ][::-1],
        weather=Weather(
            air_c=_float(weather.get("AirTemp")),
            track_c=_float(weather.get("TrackTemp")),
            humidity_pct=_float(weather.get("Humidity")),
            rain=str(weather.get("Rainfall")) not in ("", "0", "None"),
            wind_ms=_float(weather.get("WindSpeed")),
        )
        if weather
        else None,
    )
