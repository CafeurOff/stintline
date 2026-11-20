"""Timing of one finished race or sprint (OpenF1): entries, laps, stints, pit stops, race
control, weather, team radio and the circuit outline.

Network calls happen before any transaction is opened. Writes are upserts on natural keys,
and derived track-status periods are replaced as a whole inside the same transaction.
"""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta

import structlog
from django.db import models, transaction
from django.utils import timezone

from racedata.derive import reference_lap, track_status_periods
from racedata.errors import ProviderError
from racedata.fixtures import MissingFixtureError
from racedata.models import (
    DriverEntry,
    JolpicaPitStop,
    LapRecord,
    PitRecord,
    PositionSample,
    RaceControlRecord,
    ResultRecord,
    StintRecord,
    TeamRadioRecord,
    WeatherRecord,
)
from racedata.models import SessionKind as SourceKind
from racedata.sources import Sources
from stintline.ingestion.services import IngestReport, result_fields, upsert_driver_and_team
from stintline.racing.models import (
    RACE_KINDS,
    Lap,
    PitStop,
    RaceControlMessage,
    Session,
    SessionEntry,
    Stint,
    TeamRadio,
    TrackOutline,
    TrackStatus,
    WeatherSample,
)

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class _SessionPayload:
    drivers: list[DriverEntry]
    results: list[ResultRecord]
    laps: list[LapRecord]
    stints: list[StintRecord]
    pits: list[PitRecord]
    jolpica_pits: list[JolpicaPitStop]
    race_control: list[RaceControlRecord]
    weather: list[WeatherRecord]
    outline: _Outline | None
    team_radio: list[TeamRadioRecord] = field(default_factory=list)


@dataclass(frozen=True)
class _Outline:
    lap: LapRecord
    samples: list[PositionSample]


def is_ingestable(session: Session, now: datetime | None = None) -> bool:
    """Race or sprint, linked to OpenF1, and finished."""
    now = now or timezone.now()
    return (
        session.kind in RACE_KINDS
        and session.openf1_session_key is not None
        and session.ends_at is not None
        and session.ends_at <= now
    )


def ingest_session(session: Session, sources: Sources) -> IngestReport:
    """Import entries, laps, stints, pit stops, race control, weather and track status."""
    report = IngestReport()
    if session.kind not in RACE_KINDS or session.openf1_session_key is None:
        report.skipped.append(f"session {session.pk}: not a race linked to OpenF1")
        log.info("session_ingest_skipped", session_id=session.pk, kind=session.kind)
        return report

    key = session.openf1_session_key
    event = session.event
    kind = SourceKind(session.kind)
    payload = _SessionPayload(
        drivers=sources.timing.drivers(key),
        results=sources.results.results(event.season.year, event.round, kind),
        laps=sources.timing.laps(key),
        stints=sources.timing.stints(key),
        pits=sources.timing.pit(key),
        jolpica_pits=(
            sources.results.pit_stops(event.season.year, event.round)
            if kind is SourceKind.RACE
            else []
        ),
        race_control=sources.timing.race_control(key),
        weather=sources.timing.weather(key),
        outline=None,
    )
    payload = _with_outline(payload, key, sources, report)
    payload = _with_team_radio(payload, key, sources, report)
    with transaction.atomic():
        _write_session(session, payload, report)
        session.ingested_at = timezone.now()
        session.save(update_fields=["ingested_at"])
    log.info("session_ingested", session_id=session.pk, session_key=key, **report.counts)
    return report


def _with_outline(
    payload: _SessionPayload, key: int, sources: Sources, report: IngestReport
) -> _SessionPayload:
    """Fetch the reference lap trace. Optional: a missing trace never blocks timing data."""
    lap = reference_lap(payload.laps, payload.pits)
    if lap is None or lap.started_at is None or lap.lap_time_s is None:
        report.skipped.append("track outline: no clean reference lap")
        return payload
    end = lap.started_at + timedelta(seconds=lap.lap_time_s)
    try:
        samples = sources.timing.locations(key, lap.driver_number, lap.started_at, end)
    except (ProviderError, MissingFixtureError) as exc:
        report.skipped.append(f"track outline: {type(exc).__name__}")
        log.warning("track_outline_unavailable", session_key=key, error=type(exc).__name__)
        return payload
    if len(samples) < MIN_OUTLINE_SAMPLES:
        report.skipped.append(f"track outline: only {len(samples)} samples")
        return payload
    return _SessionPayload(**{**payload.__dict__, "outline": _Outline(lap, samples)})


def _with_team_radio(
    payload: _SessionPayload, key: int, sources: Sources, report: IngestReport
) -> _SessionPayload:
    """Radio references are optional: their absence never blocks timing data."""
    try:
        radio = sources.timing.team_radio(key)
    except (ProviderError, MissingFixtureError) as exc:
        report.skipped.append(f"team radio: {type(exc).__name__}")
        return payload
    return _SessionPayload(**{**payload.__dict__, "team_radio": radio})


MIN_OUTLINE_SAMPLES = 100
"""A lap at ~3.7 Hz yields 250-400 samples; fewer means a gap in the feed and a broken
drawing, so the outline is skipped instead."""


def _write_session(session: Session, p: _SessionPayload, report: IngestReport) -> None:
    entries = _upsert_entries(session, p.drivers, p.results, report)
    by_number = {e.car_number: e for e in entries}
    pit_laps = {(pit.driver_number, pit.lap_number) for pit in p.pits}

    _upsert(
        Lap,
        [
            Lap(
                entry=by_number[lap.driver_number],
                lap_number=lap.lap_number,
                lap_time_s=lap.lap_time_s if lap.lap_time_s and lap.lap_time_s > 0 else None,
                sector_1_s=lap.sector_1_s,
                sector_2_s=lap.sector_2_s,
                sector_3_s=lap.sector_3_s,
                is_pit_out_lap=lap.is_pit_out_lap,
                is_pit_in_lap=(lap.driver_number, lap.lap_number) in pit_laps,
                started_at=lap.started_at,
                speed_trap_kph=lap.speed_trap_kph,
            )
            for lap in _known(p.laps, by_number, report, "lap")
        ],
        unique=["entry", "lap_number"],
        report=report,
        name="laps",
    )
    _upsert(
        Stint,
        [
            Stint(
                entry=by_number[s.driver_number],
                stint_number=s.stint_number,
                compound=s.compound.value,
                lap_start=s.lap_start,
                lap_end=_ordered_lap_end(s, report),
                tyre_age_at_start=s.tyre_age_at_start,
            )
            for s in _known(p.stints, by_number, report, "stint")
        ],
        unique=["entry", "stint_number"],
        report=report,
        name="stints",
    )
    _upsert(
        PitStop,
        _pit_stops(p, by_number, entries, report),
        unique=["entry", "lap_number"],
        report=report,
        name="pit_stops",
    )
    _upsert(
        RaceControlMessage,
        [
            RaceControlMessage(
                session=session,
                occurred_at=m.occurred_at,
                lap_number=m.lap_number,
                category=m.category,
                flag=m.flag or "",
                scope=m.scope or "",
                sector=m.sector,
                car_number=m.driver_number,
                message=m.message,
                digest=_digest(m),
            )
            for m in p.race_control
        ],
        unique=["session", "digest"],
        report=report,
        name="race_control",
    )
    _upsert(
        WeatherSample,
        [
            WeatherSample(
                session=session,
                sampled_at=w.sampled_at,
                air_temperature_c=w.air_temperature_c,
                track_temperature_c=w.track_temperature_c,
                humidity_pct=w.humidity_pct,
                pressure_mbar=w.pressure_mbar,
                rainfall=w.rainfall,
                wind_speed_ms=w.wind_speed_ms,
                wind_direction_deg=w.wind_direction_deg,
            )
            for w in {w.sampled_at: w for w in p.weather}.values()
        ],
        unique=["session", "sampled_at"],
        report=report,
        name="weather",
    )
    TrackStatus.objects.filter(session=session).delete()
    periods = TrackStatus.objects.bulk_create(
        TrackStatus(
            session=session,
            status=period.status.value,
            started_at=period.started_at,
            ended_at=period.ended_at,
            lap_start=period.lap_start,
            lap_end=period.lap_end,
        )
        for period in track_status_periods(p.race_control)
    )
    report.add("track_status", len(periods))
    by_car = {e.car_number for e in entries}
    _upsert(
        TeamRadio,
        [
            TeamRadio(
                session=session, car_number=r.driver_number, recorded_at=r.recorded_at, url=r.url
            )
            for r in p.team_radio
            if r.driver_number in by_car
        ],
        unique=["session", "url"],
        report=report,
        name="team_radio",
    )
    if p.outline is not None:
        TrackOutline.objects.update_or_create(
            session=session,
            defaults={
                "car_number": p.outline.lap.driver_number,
                "lap_number": p.outline.lap.lap_number,
                "lap_time_s": p.outline.lap.lap_time_s,
                "points": [[s.x, s.y] for s in p.outline.samples],
            },
        )
        report.add("track_outline", 1)


def _upsert_entries(
    session: Session,
    drivers: list[DriverEntry],
    results: list[ResultRecord],
    report: IngestReport,
) -> list[SessionEntry]:
    """Driver identity comes from the classification (Jolpica), joined to timing data
    (OpenF1) on the car number raced that weekend."""
    by_car = {d.driver_number: d for d in drivers}
    colours = {d.driver_number: d.team_colour or "" for d in drivers}
    entries: list[SessionEntry] = []
    for r in results:
        driver, team = upsert_driver_and_team(r)
        entry, _ = SessionEntry.objects.update_or_create(
            session=session,
            driver=driver,
            defaults={
                "team": team,
                "car_number": r.car_number,
                "team_colour": colours.get(r.car_number, ""),
                "team_display_name": (
                    (by_car[r.car_number].team_name or "") if r.car_number in by_car else ""
                ),
                "media_id": (by_car[r.car_number].media_id or "") if r.car_number in by_car else "",
                **result_fields(r),
            },
        )
        entries.append(entry)
    unmatched = sorted(set(colours) - {e.car_number for e in entries})
    if unmatched:
        report.skipped.append(f"timing cars without classification: {unmatched}")
        log.warning("entries_unmatched", session_id=session.pk, car_numbers=unmatched)
    report.add("entries", len(entries))
    return entries


def _pit_stops(
    p: _SessionPayload,
    by_number: dict[int, SessionEntry],
    entries: list[SessionEntry],
    report: IngestReport,
) -> list[PitStop]:
    """OpenF1 pit records, enriched with Jolpica's stop number and reported duration
    (joined on driver and lap)."""
    by_driver_ref = {e.driver.ref: e for e in entries}
    reported = {
        (by_driver_ref[j.driver_id].car_number, j.lap_number): j
        for j in p.jolpica_pits
        if j.driver_id in by_driver_ref
    }
    stops: dict[tuple[int, int], PitStop] = {}
    for pit in _known(p.pits, by_number, report, "pit"):
        j = reported.get((pit.driver_number, pit.lap_number))
        stops[(pit.driver_number, pit.lap_number)] = PitStop(
            entry=by_number[pit.driver_number],
            lap_number=pit.lap_number,
            stop_number=j.stop_number if j else None,
            occurred_at=pit.occurred_at,
            pit_lane_duration_s=pit.pit_lane_duration_s,
            stationary_duration_s=pit.stationary_duration_s,
            reported_duration_s=j.duration_s if j else None,
        )
    return list(stops.values())


def _known[T: (LapRecord, StintRecord, PitRecord)](
    rows: Iterable[T], by_number: dict[int, SessionEntry], report: IngestReport, what: str
) -> list[T]:
    kept = [r for r in rows if r.driver_number in by_number]
    dropped = sorted({r.driver_number for r in rows if r.driver_number not in by_number})
    if dropped:
        report.skipped.append(f"{what} rows for unknown cars {dropped}")
    return kept


def _ordered_lap_end(stint: StintRecord, report: IngestReport) -> int | None:
    if (
        stint.lap_start is not None
        and stint.lap_end is not None
        and stint.lap_end < stint.lap_start
    ):
        report.skipped.append(
            f"stint {stint.driver_number}/{stint.stint_number}: "
            "lap_end < lap_start, dropped lap_end"
        )
        return None
    return stint.lap_end


def _digest(m: RaceControlRecord) -> str:
    identity = f"{m.occurred_at.isoformat()}|{m.category}|{m.flag}|{m.driver_number}|{m.message}"
    return hashlib.sha256(identity.encode()).hexdigest()


def _last_per_key[M: models.Model](
    model: type[M], objs: list[M], unique: list[str], report: IngestReport, name: str
) -> list[M]:
    """Keep the last row per unique key: Postgres refuses to upsert one row twice."""
    columns = {f.name: f.attname for f in model._meta.concrete_fields}
    attnames = [columns[f] for f in unique]
    by_key = {tuple(getattr(o, a) for a in attnames): o for o in objs}
    if len(by_key) < len(objs):
        report.skipped.append(f"{name}: {len(objs) - len(by_key)} duplicate row(s) dropped")
    return list(by_key.values())


def _upsert[M: (Lap, Stint, PitStop, RaceControlMessage, WeatherSample, TeamRadio)](
    model: type[M], objs: list[M], *, unique: list[str], report: IngestReport, name: str
) -> None:
    objs = _last_per_key(model, objs, unique, report, name)
    if not objs:
        report.add(name, 0)
        return
    update_fields = [
        f.name for f in model._meta.concrete_fields if not f.primary_key and f.name not in unique
    ]
    model.objects.bulk_create(
        objs,
        update_conflicts=True,
        unique_fields=unique,
        update_fields=update_fields,
        batch_size=500,
    )
    report.add(name, len(objs))
