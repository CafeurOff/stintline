"""A provider-neutral view of the live session, derived from the merged topic state.

Only what the UI and the live strategy need: who is where, on which tyres, how far into
the lap and how fast through each mini-sector, plus track status and its periods, race
control, team radio, pit-lane times and weather. Datetimes are UTC.

Some topics only carry the latest value (pit-lane times are deleted after a while,
weather is a single reading): :class:`SessionHistory` keeps what was seen so the view can
show the whole session.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
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
STATUS_SERIES = {
    "AllClear": "clear",
    "Green": "clear",
    "Yellow": "yellow",
    "DoubleYellow": "yellow",
    "SCDeployed": "safety_car",
    "SCEnding": "safety_car",
    "VSCDeployed": "virtual_safety_car",
    "VSCEnding": "virtual_safety_car",
    "Red": "red",
}
"""``SessionData.StatusSeries`` names. An ending period stays part of its period."""
SEGMENT_STATUS = {0: "none", 2048: "yellow", 2049: "green", 2051: "purple", 2064: "pit"}
"""Mini-sector codes: yellow = slower than the driver's best, green = personal best,
purple = overall best, pit = in the pit lane. Other non-zero codes count as yellow."""
EARLIER_SESSION_MARGIN = timedelta(minutes=30)
"""``StatusSeries`` also lists earlier sessions of the weekend: entries older than this
before the session start are left out of the timeline."""
LAP_RATE_RANGE = (1 / 600, 1 / 40)
"""Plausible pace between two timing loops, in laps per second: a lap between 40 s and
10 min. A rate outside it (pit stop, timing hiccup, reconnection) is not learnt."""
LAP_RATE_SMOOTHING = 0.5
"""Weight of the newest loop-to-loop pace in the smoothed rate (exponential average)."""
WEATHER_POINTS_KEPT = 200
PIT_TIMES_KEPT = 200
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


class LiveSector(_DTO):
    time_s: float | None
    """Last time through the sector."""
    personal_best: bool
    overall_best: bool
    segments: list[str]
    """Mini-sectors of the current lap: none, yellow, green, purple or pit."""


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
    """Share of the current lap completed at the last timing loop passed (0 to 1), in time:
    mini-sectors weighted by the car's sector times."""
    progress_age_s: float | None = None
    """Seconds since the car passed that timing loop (``None`` when not tracked)."""
    lap_rate: float | None = None
    """Recent pace between timing loops, in laps per second (``None`` until learnt)."""
    grid: int | None
    sectors: list[LiveSector]


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


class FlagPeriod(_DTO):
    """A spell of yellow, safety car, virtual safety car or red flag."""

    status: str
    start_at: datetime
    end_at: datetime | None
    """``None`` while it is still running."""
    start_lap: int | None
    end_lap: int | None


class PitLaneTime(_DTO):
    number: int
    lap: int | None
    pit_lane_duration_s: float
    """Pit entry to pit exit, as timed by the official feed (not stationary time)."""


class WeatherPoint(_DTO):
    lap: int | None
    air_c: float | None
    track_c: float | None
    rain: bool


class LiveView(_DTO):
    session: LiveSession
    lap: int | None
    total_laps: int | None
    track_status: str
    remaining: str | None
    remaining_s: float | None = None
    """Seconds left on the session clock at ``now``, run on while the clock is running."""
    cars: list[LiveCar]
    race_control: list[RaceControl]
    team_radio: list[Radio]
    weather: Weather | None
    timeline: list[FlagPeriod]
    pit_lane: list[PitLaneTime]
    weather_history: list[WeatherPoint]


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


def remaining_seconds(clock: dict[str, Any], now: float | None) -> float | None:
    """Session clock left: ``Remaining`` as of ``Utc``, run down to ``now`` (epoch seconds)
    while ``Extrapolating`` (the clock stops under red flags and between parts)."""
    match = re.match(r"^(\d+):(\d{2}):(\d{2})$", str(clock.get("Remaining") or ""))
    if not match:
        return None
    left = float(int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3)))
    since = _utc(clock.get("Utc"))
    if clock.get("Extrapolating") and since is not None and now is not None:
        left -= max(now - since.timestamp(), 0.0)
    return round(max(left, 0.0), 1)


def _segment_lists(line: dict[str, Any]) -> list[list[Any]]:
    sectors = line.get("Sectors") or []
    out: list[list[Any]] = []
    for sector in sectors if isinstance(sectors, list) else []:
        segments = (sector or {}).get("Segments") if isinstance(sector, dict) else None
        out.append(segments if isinstance(segments, list) else [])
    return out


def lap_fraction(line: dict[str, Any], sector_times: Sequence[float | None] = ()) -> float:
    """Share of the lap done at the last timing loop passed.

    The furthest mini-sector with a status is where the car is: loops can miss a car
    (holes in the middle of a lap), so counting the lit mini-sectors would place it
    behind. Mini-sectors are spread over their sector, and sectors weighted by the car's
    own sector times when all are known (the outline is spaced in time), else by their
    number of mini-sectors.
    """
    segments = _segment_lists(line)
    counts = [len(s) for s in segments]
    last: tuple[int, int] | None = None
    for i, sector in enumerate(segments):
        for j, segment in enumerate(sector):
            if _int((segment or {}).get("Status")) if isinstance(segment, dict) else None:
                last = (i, j)
    if last is None or not sum(counts):
        return 0.0
    times = list(sector_times)
    weights: list[float] = (
        [t or 0.0 for t in times]
        if len(times) == len(counts) and all(t is not None and t > 0 for t in times)
        else [float(c) for c in counts]
    )
    i, j = last
    done = sum(weights[:i]) + weights[i] * (j + 1) / counts[i]
    return round(min(done / sum(weights), 1.0), 4)


def _segment(value: Any) -> str:
    code = _int((value or {}).get("Status")) if isinstance(value, dict) else None
    if not code:
        return "none"
    return SEGMENT_STATUS.get(code, "yellow")


def _sectors(line: dict[str, Any]) -> list[LiveSector]:
    sectors = line.get("Sectors") or []
    out: list[LiveSector] = []
    for item in sectors if isinstance(sectors, list) else []:
        sector = item if isinstance(item, dict) else {}
        segments = sector.get("Segments") or []
        out.append(
            LiveSector(
                time_s=lap_seconds(sector.get("Value")),
                personal_best=bool(sector.get("PersonalFastest")),
                overall_best=bool(sector.get("OverallFastest")),
                segments=[_segment(x) for x in (segments if isinstance(segments, list) else [])],
            )
        )
    return out


def _tyres(app: dict[str, Any]) -> tuple[str | None, int | None, bool | None]:
    stints = app.get("Stints") or []
    if not isinstance(stints, list) or not stints:
        return None, None, None
    stint = stints[-1] or {}
    start, run = _int(stint.get("StartLaps")), _int(stint.get("TotalLaps"))
    age = None if start is None and run is None else (start or 0) + (run or 0)
    new = stint.get("New")
    return stint.get("Compound"), age, None if new is None else str(new).lower() == "true"


def _car(
    number: str,
    line: dict[str, Any],
    driver: dict[str, Any],
    app: dict[str, Any],
    *,
    track: CarTrack | None,
    now: float | None,
    sector_times: Sequence[float | None],
) -> LiveCar:
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
        lap_progress=track.fraction if track else lap_fraction(line, sector_times),
        progress_age_s=round(max(now - track.at, 0.0), 3) if track and now is not None else None,
        lap_rate=round(track.rate, 6) if track and track.rate is not None else None,
        grid=_int(app.get("GridPos")) or None,
        sectors=_sectors(line),
    )


def _lap_at(laps: list[tuple[datetime, int]], at: datetime) -> int | None:
    lap = None
    for start, number in laps:
        if start > at:
            break
        lap = number
    return lap


def timeline(state: LiveState, starts_at: datetime | None) -> list[FlagPeriod]:
    """Flag periods from ``SessionData``: each track-status change opens a period and
    closes the previous one; clear spells are left out."""
    data = state.get("SessionData")
    laps = sorted(
        (at, number)
        for item in (data.get("Series") or [])
        if isinstance(item, dict)
        and (at := _utc(item.get("Utc"))) is not None
        and (number := _int(item.get("Lap"))) is not None
    )
    floor = starts_at - EARLIER_SESSION_MARGIN if starts_at else None
    changes = [
        (at, STATUS_SERIES.get(str(item["TrackStatus"]), "clear"))
        for item in (data.get("StatusSeries") or [])
        if isinstance(item, dict)
        and "TrackStatus" in item
        and (at := _utc(item.get("Utc"))) is not None
        and (floor is None or at >= floor)
    ]
    changes.sort(key=lambda change: change[0])
    out: list[FlagPeriod] = []
    current: tuple[datetime, str] | None = None
    for at, status in changes:
        if current and current[1] == status:
            continue
        if current and current[1] != "clear":
            out.append(_period(current, at, laps))
        current = (at, status)
    if current and current[1] != "clear":
        out.append(_period(current, None, laps))
    return out


def _period(
    start: tuple[datetime, str], end: datetime | None, laps: list[tuple[datetime, int]]
) -> FlagPeriod:
    return FlagPeriod(
        status=start[1],
        start_at=start[0],
        end_at=end,
        start_lap=_lap_at(laps, start[0]),
        end_lap=_lap_at(laps, end) if end else None,
    )


@dataclass(slots=True)
class CarTrack:
    """Where a car was at the last timing loop it passed, when, and its recent pace."""

    fraction: float
    at: float
    rate: float | None = None


def _wrapped(delta: float) -> float:
    """A change of lap fraction folded into [-0.5, 0.5): crossing the line is a small step."""
    return (delta + 0.5) % 1.0 - 0.5


class SessionHistory:
    """What the feed shows only once: pit-lane times (deleted from the topic after a
    while), weather readings kept per lap, each car's last sector times, and when each
    car passed its last timing loop (with ``at``, the time the update was applied)."""

    def __init__(self) -> None:
        self._pits: dict[tuple[int, int | None], float] = {}
        self._weather: dict[int | None, WeatherPoint] = {}
        self._sector_times: dict[str, list[float | None]] = {}
        self.tracks: dict[str, CarTrack] = {}

    def sector_times(self, number: str) -> list[float | None]:
        return self._sector_times.get(number, [])

    def _follow(self, lines: dict[str, Any], at: float) -> None:
        for number, line in lines.items():
            if not isinstance(line, dict):
                continue
            known = self._sector_times.setdefault(number, [])
            sectors = line.get("Sectors") or []
            for i, sector in enumerate(sectors if isinstance(sectors, list) else []):
                value = (
                    lap_seconds((sector or {}).get("Value")) if isinstance(sector, dict) else None
                )
                while len(known) <= i:
                    known.append(None)
                if value:
                    known[i] = value
            fraction = lap_fraction(line, known)
            track = self.tracks.get(number)
            if track is None:
                self.tracks[number] = CarTrack(fraction, at)
                continue
            if fraction == track.fraction:
                continue
            step, elapsed = _wrapped(fraction - track.fraction), at - track.at
            low, high = LAP_RATE_RANGE
            if step > 0 and elapsed > 0 and low <= step / elapsed <= high:
                pace = step / elapsed
                track.rate = (
                    pace
                    if track.rate is None
                    else track.rate + LAP_RATE_SMOOTHING * (pace - track.rate)
                )
            track.fraction, track.at = fraction, at

    def update(self, state: LiveState, at: float | None = None) -> None:
        if at is not None:
            lines = state.get("TimingData").get("Lines") or {}
            if isinstance(lines, dict):
                self._follow(lines, at)
        times = state.get("PitLaneTimeCollection").get("PitTimes") or {}
        for key, item in times.items() if isinstance(times, dict) else []:
            if not isinstance(item, dict):
                continue
            number = _int(item.get("RacingNumber") or key)
            duration = _float(item.get("Duration"))
            if number is not None and duration is not None and duration > 0:
                self._pits[(number, _int(item.get("Lap")))] = duration
        weather = state.get("WeatherData")
        if weather:
            lap = _int(state.get("LapCount").get("CurrentLap"))
            self._weather[lap] = WeatherPoint(
                lap=lap,
                air_c=_float(weather.get("AirTemp")),
                track_c=_float(weather.get("TrackTemp")),
                rain=_raining(weather),
            )

    def pit_lane(self) -> list[PitLaneTime]:
        rows = [
            PitLaneTime(number=number, lap=lap, pit_lane_duration_s=round(duration, 3))
            for (number, lap), duration in self._pits.items()
        ]
        rows.sort(key=lambda r: (r.lap is None, r.lap or 0, r.number))
        return rows[-PIT_TIMES_KEPT:]

    def weather(self) -> list[WeatherPoint]:
        points = sorted(self._weather.values(), key=lambda p: (p.lap is None, p.lap or 0))
        return points[-WEATHER_POINTS_KEPT:]


def _raining(weather: dict[str, Any]) -> bool:
    return str(weather.get("Rainfall")) not in ("", "0", "None")


def view(
    state: LiveState, history: SessionHistory | None = None, now: float | None = None
) -> LiveView:
    """The session as the UI shows it. ``now`` (same clock as ``SessionHistory.update``)
    dates each car's last timing loop."""
    info = state.get("SessionInfo")
    meeting = info.get("Meeting") or {}
    lines = state.get("TimingData").get("Lines") or {}
    apps = state.get("TimingAppData").get("Lines") or {}
    drivers = state.get("DriverList")
    cars = [
        _car(
            number,
            line,
            drivers.get(number) or {},
            apps.get(number) or {},
            track=history.tracks.get(number) if history else None,
            now=now,
            sector_times=history.sector_times(number) if history else [],
        )
        for number, line in lines.items()
        if number.isdigit() and isinstance(line, dict)
    ]
    cars.sort(key=lambda c: (c.position is None, c.position or 0, c.number))
    lap_count = state.get("LapCount")
    messages = state.get("RaceControlMessages").get("Messages") or []
    captures = state.get("TeamRadio").get("Captures") or []
    weather = state.get("WeatherData")
    path = str(info.get("Path") or "")
    starts_at = session_start(info)
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
            starts_at=starts_at,
        ),
        lap=_int(lap_count.get("CurrentLap")),
        total_laps=_int(lap_count.get("TotalLaps")),
        track_status=TRACK_STATUS.get(str(state.get("TrackStatus").get("Status")), "clear"),
        remaining=state.get("ExtrapolatedClock").get("Remaining"),
        remaining_s=remaining_seconds(state.get("ExtrapolatedClock"), now),
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
            rain=_raining(weather),
            wind_ms=_float(weather.get("WindSpeed")),
        )
        if weather
        else None,
        timeline=timeline(state, starts_at),
        pit_lane=history.pit_lane() if history else [],
        weather_history=history.weather() if history else [],
    )
