"""A live-feed recording rebuilt from a stored race, to try the live mode at any time.

It writes the same JSON lines as a real recording (``racedata.live.recording``): one
snapshot in the official topic format, then updates every few race seconds with
positions, gaps, laps, sector times and coloured mini-sectors, plus the session's lap
and status series, race control messages, pit-lane times and weather when they happened.
Replay it with ``manage.py live --replay <file> --speed 20``. Nothing comes from the
official feed, so the file can be shared freely.

Stored laps have three sector times but no mini-sector times: every mini-sector of a
sector takes that sector's colour (purple, green or yellow) as the car passes it.
"""

from __future__ import annotations

import datetime as dt
import json
from bisect import bisect_right
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from stintline.racing.models import Lap, Session, TrackStatus, TrackStatusKind
from stintline.strategy_api import services

STEP_S = 4.0
"""Race seconds between two timing updates (the real feed sends several per second)."""
SEGMENTS = (8, 8, 6)
"""Mini-sectors per sector, as on most circuits."""
PIT_SEGMENTS_IN = 3
"""Mini-sectors at the end of an in-lap shown as pit lane."""
PIT_SEGMENTS_OUT = 2
"""Mini-sectors at the start of an out-lap shown as pit lane."""
TRACK_CODES = {
    TrackStatusKind.SAFETY_CAR: "4",
    TrackStatusKind.VIRTUAL_SAFETY_CAR: "6",
    TrackStatusKind.RED_FLAG: "5",
}
STATUS_NAMES = {"1": "AllClear", "4": "SCDeployed", "6": "VSCDeployed", "5": "Red"}
SEGMENT_CODES = {"yellow": 2048, "green": 2049, "purple": 2051, "pit": 2064}


@dataclass
class _Car:
    number: int
    lines: list[float]
    compounds: list[str | None]
    ages: list[int | None]
    pits: set[int]
    sectors: dict[int, tuple[float | None, float | None, float | None]] = field(
        default_factory=dict
    )
    """Sector times per lap number."""
    colours: dict[int, tuple[str, str, str]] = field(default_factory=dict)
    """Colour of each sector per lap: purple, green or yellow."""

    def laps_at(self, t: float) -> int:
        return bisect_right(self.lines, t)

    def fraction_at(self, t: float) -> float:
        done = self.laps_at(t)
        if done >= len(self.lines):
            return 0.0
        start = self.lines[done - 1] if done else 0.0
        return max(0.0, min((t - start) / (self.lines[done] - start), 0.999))


def colour_sectors(cars: list[_Car]) -> None:
    """Colour every sector the way timing screens do, in the order laps were completed:
    purple beats everyone's best so far, green beats the driver's own best."""
    done = sorted(
        (
            (car.lines[lap - 1], lap, car)
            for car in cars
            for lap in car.sectors
            if lap <= len(car.lines)
        ),
        key=lambda item: (item[0], item[1], item[2].number),
    )
    overall: list[float | None] = [None, None, None]
    personal: dict[int, list[float | None]] = {}
    for _, lap, car in done:
        mine = personal.setdefault(car.number, [None, None, None])
        colours: list[str] = []
        for k, value in enumerate(car.sectors[lap]):
            if value is None:
                colours.append("yellow")
                continue
            best, own = overall[k], mine[k]
            if best is None or value < best:
                colours.append("purple")
            elif own is None or value < own:
                colours.append("green")
            else:
                colours.append("yellow")
            overall[k] = value if best is None else min(best, value)
            mine[k] = value if own is None else min(own, value)
        car.colours[lap] = (colours[0], colours[1], colours[2])


def _sectors(car: _Car, lap: int, fraction: float, finished: bool) -> list[dict[str, Any]]:
    """Sectors of ``lap`` (1-based, in progress) at ``fraction`` of the lap."""
    total = sum(SEGMENTS)
    passed = total if finished else int(fraction * total)
    pit_from = total - PIT_SEGMENTS_IN if lap in car.pits else total
    pit_until = PIT_SEGMENTS_OUT if (lap - 1) in car.pits else 0
    colours = car.colours.get(lap, ("yellow", "yellow", "yellow"))
    now = car.sectors.get(lap, (None, None, None))
    before = car.sectors.get(lap - 1, (None, None, None))
    before_colours = car.colours.get(lap - 1, ("yellow", "yellow", "yellow"))
    out: list[dict[str, Any]] = []
    start = 0
    for k, count in enumerate(SEGMENTS):
        segments = []
        for i in range(start, start + count):
            if i >= passed:
                segments.append({"Status": 0})
            elif i >= pit_from or i < pit_until:
                segments.append({"Status": SEGMENT_CODES["pit"]})
            else:
                segments.append({"Status": SEGMENT_CODES[colours[k]]})
        complete = passed >= start + count
        value, colour = (now[k], colours[k]) if complete else (before[k], before_colours[k])
        out.append(
            {
                "Segments": segments,
                "Value": "" if value is None else _lap_text(value).removeprefix("0:"),
                "PersonalFastest": colour in ("green", "purple"),
                "OverallFastest": colour == "purple",
            }
        )
        start += count
    return out


def _lap_text(seconds: float) -> str:
    minutes = int(seconds // 60)
    return f"{minutes}:{seconds - minutes * 60:06.3f}"


def _utc(at: dt.datetime) -> str:
    return at.astimezone(dt.UTC).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def race_start(session: Session) -> dt.datetime:
    """Race time zero: when lap 1 started, else the session start."""
    first = (
        Lap.objects.filter(entry__session=session, lap_number=1, started_at__isnull=False)
        .order_by("started_at")
        .values_list("started_at", flat=True)
        .first()
    )
    fallback = (
        session.starts_at or session.scheduled_start or dt.datetime(2000, 1, 1, tzinfo=dt.UTC)
    )
    return first or fallback


def timed_events(
    session: Session, zero: dt.datetime, cars: list[_Car]
) -> list[tuple[float, str, Any]]:
    """Race control, pit-lane times and weather at the race time they happened."""
    events: list[tuple[float, str, Any]] = []
    for index, message in enumerate(session.race_control.order_by("occurred_at", "pk")):
        at = (message.occurred_at - zero).total_seconds()
        item = {
            "Utc": _utc(message.occurred_at),
            "Lap": message.lap_number,
            "Category": message.category,
            "Flag": message.flag,
            "Message": message.message,
        }
        events.append((at, "RaceControlMessages", {"Messages": {str(index): item}}))
    lines = {car.number: car.lines for car in cars}
    for stop in session.entries.values_list(
        "car_number", "pit_stops__lap_number", "pit_stops__pit_lane_duration_s"
    ):
        number, lap, lane = stop
        car_lines = lines.get(number)
        if lap is None or lane is None or not car_lines or lap > len(car_lines):
            continue
        payload = {
            "PitTimes": {
                str(number): {
                    "RacingNumber": str(number),
                    "Duration": f"{lane:.3f}",
                    "Lap": str(lap),
                }
            }
        }
        events.append((car_lines[lap - 1] + lane / 2, "PitLaneTimeCollection", payload))
    for sample in session.weather.order_by("sampled_at"):
        weather = {
            "AirTemp": _decimal(sample.air_temperature_c),
            "TrackTemp": _decimal(sample.track_temperature_c),
            "Humidity": _decimal(sample.humidity_pct),
            "Rainfall": "1" if sample.rainfall else "0",
            "WindSpeed": _decimal(sample.wind_speed_ms),
        }
        events.append(((sample.sampled_at - zero).total_seconds(), "WeatherData", weather))
    events.sort(key=lambda e: e[0])
    return events


def _decimal(value: float | None) -> str:
    return "" if value is None else f"{value:.1f}"


def _cars(session: Session) -> tuple[int, list[_Car]]:
    data = services.replay(services.race_context(session))
    cars = [
        _Car(
            c["car_number"],
            [t for t in c["line_times_s"] if t is not None],
            c["compounds"],
            c["tyre_ages"],
            set(c["pit_in_laps"]),
        )
        for c in data["cars"]
        if any(t is not None for t in c["line_times_s"])
    ]
    by_number = {car.number: car for car in cars}
    for number, lap, s1, s2, s3 in Lap.objects.filter(entry__session=session).values_list(
        "entry__car_number", "lap_number", "sector_1_s", "sector_2_s", "sector_3_s"
    ):
        if number in by_number:
            by_number[number].sectors[lap] = (s1, s2, s3)
    colour_sectors(cars)
    return int(data["total_laps"]), cars


def _snapshot(session: Session, total: int) -> dict[str, Any]:
    entries = {e.car_number: e for e in session.entries.select_related("driver", "team")}
    event = session.event
    circuit = event.circuit
    return {
        "SessionInfo": {
            "Meeting": {
                "Name": event.name,
                "Circuit": {"Key": circuit.openf1_circuit_key, "ShortName": circuit.locality},
                "Country": {"Name": circuit.country},
            },
            "Key": session.openf1_session_key,
            "Type": "Race",
            "Name": "Race",
            "StartDate": session.starts_at.strftime("%Y-%m-%dT%H:%M:%S")
            if session.starts_at
            else "",
            "GmtOffset": "00:00:00",
            "Path": "",
        },
        "SessionStatus": {"Status": "Started"},
        "SessionData": {"Series": [], "StatusSeries": []},
        "LapCount": {"CurrentLap": 1, "TotalLaps": total},
        "TrackStatus": {"Status": "1"},
        "DriverList": {
            str(n): {
                "Tla": e.driver.code or str(n),
                "FirstName": e.driver.given_name,
                "LastName": e.driver.family_name,
                "TeamName": e.team.name,
                "TeamColour": e.team_colour,
            }
            for n, e in entries.items()
        },
        "TimingData": {"Lines": {}},
        "TimingAppData": {"Lines": {}},
        "RaceControlMessages": {"Messages": []},
        "PitLaneTimeCollection": {"PitTimes": {}},
    }


def build(session: Session, out: Path) -> int:
    """Write a recording of ``session`` to ``out``; returns the number of lines."""
    total, cars = _cars(session)
    grid = {e.car_number: e.grid_position for e in session.entries.all()}
    zero = race_start(session)
    events = timed_events(session, zero, cars)
    statuses = list(session.track_statuses.all())
    end = max(c.lines[-1] for c in cars)
    lines_written = 0
    with out.open("w", encoding="utf-8") as file:

        def write(t: float, topic: str, payload: Any) -> None:
            nonlocal lines_written
            record = {"kind": "feed", "received_at": t, "args": [topic, payload, ""]}
            file.write(json.dumps(record, separators=(",", ":")) + "\n")
            lines_written += 1

        snapshot = {"kind": "snapshot", "received_at": 0.0, "data": _snapshot(session, total)}
        file.write(json.dumps(snapshot, separators=(",", ":")) + "\n")
        lines_written += 1
        t = 0.0
        last_status = "1"
        last_lap = 0
        statuses_sent = 0
        next_event = 0
        while t <= end + STEP_S:
            order = sorted(cars, key=lambda c: -(c.laps_at(t) + c.fraction_at(t)))
            leader = order[0]
            timing = {
                str(car.number): _timing(car, position, order, t=t, total=total)
                for position, car in enumerate(order, start=1)
            }
            apps = {str(car.number): _app(car, grid.get(car.number), t) for car in order}
            lap = min(leader.laps_at(t) + 1, total)
            status = _status(statuses, lap, total)
            write(t, "TimingData", {"Lines": timing})
            write(t, "TimingAppData", {"Lines": apps})
            write(t, "LapCount", {"CurrentLap": lap})
            now = _utc(zero + dt.timedelta(seconds=t))
            if lap != last_lap:
                write(t, "SessionData", {"Series": {str(lap - 1): {"Utc": now, "Lap": lap}}})
                last_lap = lap
            if status != last_status:
                write(t, "TrackStatus", {"Status": status})
                item = {"Utc": now, "TrackStatus": STATUS_NAMES[status]}
                write(t, "SessionData", {"StatusSeries": {str(statuses_sent): item}})
                statuses_sent += 1
                last_status = status
            while next_event < len(events) and events[next_event][0] <= t:
                _, topic, payload = events[next_event]
                write(t, topic, payload)
                next_event += 1
            t += STEP_S
        write(t, "SessionStatus", {"Status": "Finished"})
    return lines_written


def _status(statuses: list[TrackStatus], lap: int, total: int) -> str:
    return next(
        (
            TRACK_CODES[TrackStatusKind(s.status)]
            for s in statuses
            if s.lap_start is not None and s.lap_start <= lap <= (s.lap_end or total)
        ),
        "1",
    )


def _app(car: _Car, grid: int | None, t: float) -> dict[str, Any]:
    lap_index = min(car.laps_at(t), len(car.lines) - 1)
    return {
        "GridPos": str(grid or ""),
        "Stints": [
            {
                "Compound": car.compounds[lap_index] or "UNKNOWN",
                "New": "true",
                "StartLaps": 0,
                "TotalLaps": car.ages[lap_index] or 0,
            }
        ],
    }


def _timing(car: _Car, position: int, order: list[_Car], *, t: float, total: int) -> dict[str, Any]:
    done = car.laps_at(t)
    finished = done >= len(car.lines)
    if position == 1:
        gap = f"LAP {min(done + 1, total)}"
        interval = ""
    else:
        gap = _gap(car, order[0], t)
        interval = _gap(car, order[position - 2], t)
    last = car.lines[done - 1] - (car.lines[done - 2] if done > 1 else 0.0) if done else None
    return {
        "Position": str(position),
        "GapToLeader": gap,
        "IntervalToPositionAhead": {"Value": interval},
        "NumberOfLaps": done,
        "NumberOfPitStops": sum(1 for lap in car.pits if lap <= done),
        "InPit": (done + 1) in car.pits and car.fraction_at(t) > 0.9,
        "Retired": finished and len(car.lines) < total,
        "Sectors": _sectors(car, done if finished else done + 1, car.fraction_at(t), finished),
        "LastLapTime": {"Value": _lap_text(last) if last else ""},
    }


def _progress(car: _Car, t: float) -> float:
    return car.laps_at(t) + car.fraction_at(t)


def _time_at(car: _Car, progress: float) -> float:
    """When ``car`` reached ``progress`` (laps), interpolating within the lap."""
    lap = min(int(progress), len(car.lines) - 1)
    start = car.lines[lap - 1] if lap else 0.0
    return start + (progress - lap) * (car.lines[lap] - start)


def _gap(car: _Car, other: _Car, t: float) -> str:
    """Time since ``other`` passed the point where ``car`` is now, or laps behind. Measured
    at the car's position, so gaps follow the running order and never go negative."""
    mine, theirs = _progress(car, t), _progress(other, t)
    if mine == 0:
        return ""
    if theirs - mine >= 1:
        return f"{int(theirs - mine)}L"
    return f"+{max(t - _time_at(other, mine), 0.0):.3f}"
