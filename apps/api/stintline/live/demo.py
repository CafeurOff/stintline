"""A live-feed recording rebuilt from a stored race, to try the live mode at any time.

It writes the same JSON lines as a real recording (``racedata.live.recording``): one
snapshot in the official topic format, then a ``TimingData`` update every few race
seconds with positions, gaps, laps and mini-sector progress. Replay it with
``manage.py live --replay <file> --speed 20``. Nothing comes from the official feed, so
the file can be shared freely.
"""

from __future__ import annotations

import json
from bisect import bisect_right
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from stintline.racing.models import Session, TrackStatusKind
from stintline.strategy_api import services

STEP_S = 4.0
"""Race seconds between two timing updates (the real feed sends several per second)."""
SEGMENTS = (8, 8, 6)
"""Mini-sectors per sector, as on most circuits."""
TRACK_CODES = {
    TrackStatusKind.SAFETY_CAR: "4",
    TrackStatusKind.VIRTUAL_SAFETY_CAR: "6",
    TrackStatusKind.RED_FLAG: "5",
}


@dataclass
class _Car:
    number: int
    lines: list[float]
    compounds: list[str | None]
    ages: list[int | None]
    pits: set[int]

    def laps_at(self, t: float) -> int:
        return bisect_right(self.lines, t)

    def fraction_at(self, t: float) -> float:
        done = self.laps_at(t)
        if done >= len(self.lines):
            return 0.0
        start = self.lines[done - 1] if done else 0.0
        return max(0.0, min((t - start) / (self.lines[done] - start), 0.999))


def _sectors(fraction: float) -> list[dict[str, Any]]:
    passed = int(fraction * sum(SEGMENTS))
    out = []
    for count in SEGMENTS:
        out.append({"Segments": [{"Status": 2048 if i < passed else 0} for i in range(count)]})
        passed = max(0, passed - count)
    return out


def _lap_text(seconds: float) -> str:
    minutes = int(seconds // 60)
    return f"{minutes}:{seconds - minutes * 60:06.3f}"


def build(session: Session, out: Path) -> int:
    """Write a recording of ``session`` to ``out``; returns the number of lines."""
    context = services.race_context(session)
    data = services.replay(context)
    total = int(data["total_laps"])
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
    entries = {e.car_number: e for e in session.entries.select_related("driver", "team")}
    event = session.event
    circuit = event.circuit
    statuses = list(session.track_statuses.all())
    snapshot = {
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
    }
    end = max(c.lines[-1] for c in cars)
    lines_written = 0
    with out.open("w", encoding="utf-8") as file:

        def write(record: dict[str, Any]) -> None:
            nonlocal lines_written
            file.write(json.dumps(record, separators=(",", ":")) + "\n")
            lines_written += 1

        write({"kind": "snapshot", "received_at": 0.0, "data": snapshot})
        t = 0.0
        last_status = "1"
        while t <= end + STEP_S:
            order = sorted(cars, key=lambda c: -(c.laps_at(t) + c.fraction_at(t)))
            leader = order[0]
            timing: dict[str, Any] = {}
            apps: dict[str, Any] = {}
            for position, car in enumerate(order, start=1):
                done = car.laps_at(t)
                finished = done >= len(car.lines)
                lap_index = min(done, len(car.lines) - 1)
                if position == 1:
                    gap = f"LAP {min(done + 1, total)}"
                    interval = ""
                else:
                    ref = order[position - 2]
                    gap = _gap(car, leader, done)
                    interval = _gap(car, ref, done)
                last = (
                    car.lines[done - 1] - (car.lines[done - 2] if done > 1 else 0.0)
                    if done
                    else None
                )
                timing[str(car.number)] = {
                    "Position": str(position),
                    "GapToLeader": gap,
                    "IntervalToPositionAhead": {"Value": interval},
                    "NumberOfLaps": done,
                    "NumberOfPitStops": sum(1 for lap in car.pits if lap <= done),
                    "InPit": (done + 1) in car.pits and car.fraction_at(t) > 0.9,
                    "Retired": finished and len(car.lines) < total,
                    "Sectors": _sectors(0.999 if finished else car.fraction_at(t)),
                    "LastLapTime": {"Value": _lap_text(last) if last else ""},
                }
                apps[str(car.number)] = {
                    "Stints": [
                        {
                            "Compound": car.compounds[lap_index] or "UNKNOWN",
                            "New": "true",
                            "StartLaps": 0,
                            "TotalLaps": car.ages[lap_index] or 0,
                        }
                    ]
                }
            lap = min(leader.laps_at(t) + 1, total)
            status = next(
                (
                    TRACK_CODES[TrackStatusKind(s.status)]
                    for s in statuses
                    if s.lap_start is not None and s.lap_start <= lap <= (s.lap_end or total)
                ),
                "1",
            )
            write({"kind": "feed", "received_at": t, "args": ["TimingData", {"Lines": timing}, ""]})
            write(
                {"kind": "feed", "received_at": t, "args": ["TimingAppData", {"Lines": apps}, ""]}
            )
            write({"kind": "feed", "received_at": t, "args": ["LapCount", {"CurrentLap": lap}, ""]})
            if status != last_status:
                write(
                    {
                        "kind": "feed",
                        "received_at": t,
                        "args": ["TrackStatus", {"Status": status}, ""],
                    }
                )
                last_status = status
            t += STEP_S
        write(
            {
                "kind": "feed",
                "received_at": t,
                "args": ["SessionStatus", {"Status": "Finished"}, ""],
            }
        )
    return lines_written


def _gap(car: _Car, other: _Car, done: int) -> str:
    """Gap at the last line both cars crossed, or laps behind."""
    if done == 0:
        return ""
    other_done = len([x for x in other.lines if x <= car.lines[done - 1]])
    if other_done > done:
        return f"{other_done - done}L"
    k = done - 1
    if k >= len(other.lines):
        return ""
    return f"+{car.lines[k] - other.lines[k]:.3f}"
