"""Season-wide results, qualifying, championship standings and reference data (Jolpica).

Covers every season since 1950. Seasons with timing data (2023+) get the same treatment:
their race entries already exist from session ingestion and are only completed here, so
timing-only columns (team colour, media id) are never touched.
"""

from __future__ import annotations

import structlog
from django.db import transaction
from django.utils import timezone

from racedata.models import (
    QualifyingRecord,
    ResultRecord,
    StandingRecord,
)
from racedata.models import SessionKind as SourceKind
from racedata.providers.base import HistorySource
from racedata.sources import Sources
from stintline.ingestion.services import (
    IngestReport,
    _upsert_event,
    result_fields,
    upsert_driver_and_team,
)
from stintline.racing.models import (
    Circuit,
    Driver,
    Event,
    Season,
    Session,
    SessionEntry,
    SessionKind,
    Standing,
    Team,
)

log = structlog.get_logger(__name__)

FIRST_SEASON = 1950
PER_ROUND_STANDINGS_FROM = 2023
"""Championship tables after every round for seasons with timing data (charts of the title
fight). Older seasons keep the final table only, to stay within Jolpica's hourly limit."""


class HistoryUnavailableError(RuntimeError):
    """The sources were built without a history (Jolpica) source."""


def _history(sources: Sources) -> HistorySource:
    if sources.history is None:
        raise HistoryUnavailableError("these sources have no history source")
    return sources.history


def ingest_reference(sources: Sources) -> IngestReport:
    """Biographies of every driver, constructor and circuit since 1950."""
    history = _history(sources)
    report = IngestReport()
    drivers, teams, circuits = history.drivers(), history.constructors(), history.circuits()
    with transaction.atomic():
        _bulk_upsert(
            Driver,
            [
                Driver(
                    ref=d.driver_id,
                    code=d.code or "",
                    given_name=d.given_name,
                    family_name=d.family_name,
                    permanent_number=d.permanent_number,
                    date_of_birth=d.date_of_birth,
                    nationality=d.nationality or "",
                    wikipedia_url=d.url or "",
                )
                for d in drivers
            ],
        )
        _bulk_upsert(
            Team,
            [
                Team(
                    ref=t.constructor_id,
                    name=t.name,
                    nationality=t.nationality or "",
                    wikipedia_url=t.url or "",
                )
                for t in teams
            ],
        )
        _bulk_upsert(
            Circuit,
            [
                Circuit(
                    ref=c.circuit_id,
                    name=c.name,
                    locality=c.locality,
                    country=c.country,
                    latitude=c.latitude,
                    longitude=c.longitude,
                    wikipedia_url=c.url or "",
                )
                for c in circuits
            ],
            keep=("openf1_circuit_key",),
        )
    report.add("drivers", len(drivers))
    report.add("teams", len(teams))
    report.add("circuits", len(circuits))
    log.info("reference_ingested", **report.counts)
    return report


def _bulk_upsert[M: (Driver, Team, Circuit)](
    model: type[M], objs: list[M], keep: tuple[str, ...] = ()
) -> None:
    """Insert or update on the natural key ``ref``. Fields in ``keep`` are never overwritten
    (they come from another source, e.g. OpenF1 circuit keys)."""
    fields = [
        f.name
        for f in model._meta.concrete_fields
        if not f.primary_key and f.name != "ref" and f.name not in keep
    ]
    model.objects.bulk_create(
        objs, update_conflicts=True, unique_fields=["ref"], update_fields=fields, batch_size=500
    )


def ingest_season_results(season: int, sources: Sources) -> IngestReport:
    """Calendar (if missing), race and sprint classifications, qualifying and standings."""
    history = _history(sources)
    report = IngestReport()
    events = {e.round: e for e in Event.objects.filter(season__year=season)}
    if not events:
        for info in history.season_events(season):
            events[info.round] = _upsert_event(info, {})
    races = history.season_results(season, SourceKind.RACE)
    sprints = history.season_results(season, SourceKind.SPRINT)
    qualifying = history.season_qualifying(season)
    rounds = sorted(races)
    standings = _standings(history, season, rounds)

    identities = _Identities()
    with transaction.atomic():
        for round_, rows in races.items():
            if round_ in events:
                _write_results(events[round_], SessionKind.RACE, rows, report, identities)
        for round_, rows in sprints.items():
            if round_ in events:
                _write_results(events[round_], SessionKind.SPRINT, rows, report, identities)
        for round_, quali in qualifying.items():
            if round_ in events:
                _write_qualifying(events[round_], quali, report, identities)
        _write_standings(season, standings, report)
        Season.objects.filter(year=season).update(results_ingested_at=timezone.now())
    log.info("season_results_ingested", season=season, **report.counts)
    return report


def _standings(history: HistorySource, season: int, rounds: list[int]) -> list[StandingRecord]:
    out: list[StandingRecord] = []
    targets: list[int | None] = list(rounds) if season >= PER_ROUND_STANDINGS_FROM else [None]
    for round_ in targets:
        out.extend(history.standings(season, round_, constructors=False))
        # The constructors' championship only exists since 1958.
        out.extend(_tagged(history.standings(season, round_, constructors=True)))
    return out


_CONSTRUCTOR_TAG = "constructor:"


def _tagged(rows: list[StandingRecord]) -> list[StandingRecord]:
    return [
        r.model_copy(update={"competitor_id": _CONSTRUCTOR_TAG + r.competitor_id}) for r in rows
    ]


def _session(event: Event, kind: SessionKind) -> Session:
    session, _ = Session.objects.get_or_create(event=event, kind=kind.value)
    return session


class _Identities:
    """Drivers and teams upserted once per import run instead of once per result row."""

    def __init__(self) -> None:
        self._seen: dict[tuple[str, str], tuple[Driver, Team]] = {}

    def get(self, r: ResultRecord | QualifyingRecord) -> tuple[Driver, Team]:
        key = (r.driver_id, r.constructor_id)
        if key not in self._seen:
            self._seen[key] = upsert_driver_and_team(r)
        return self._seen[key]


def _write_results(
    event: Event,
    kind: SessionKind,
    rows: list[ResultRecord],
    report: IngestReport,
    identities: _Identities,
) -> None:
    session = _session(event, kind)
    taken = _Taken(session)
    entries: list[SessionEntry] = []
    for r in rows:
        driver, team = identities.get(r)
        if not taken.allows(driver.pk, r.car_number):
            report.skipped.append(f"{event} {kind}: shared or duplicate entry {r.driver_id}")
            continue
        entries.append(
            SessionEntry(
                session=session,
                driver=driver,
                team=team,
                car_number=r.car_number,
                **result_fields(r),
            )
        )
    _upsert_entries(entries, ["team", "car_number", *RESULT_COLUMNS])
    report.add(f"{kind.value.lower()}_results", len(entries))


def _write_qualifying(
    event: Event, rows: list[QualifyingRecord], report: IngestReport, identities: _Identities
) -> None:
    session = _session(event, SessionKind.QUALIFYING)
    taken = _Taken(session)
    entries: list[SessionEntry] = []
    for r in rows:
        driver, team = identities.get(r)
        if not taken.allows(driver.pk, r.car_number):
            report.skipped.append(f"{event} Q: duplicate entry {r.driver_id}")
            continue
        entries.append(
            SessionEntry(
                session=session,
                driver=driver,
                team=team,
                car_number=r.car_number,
                finish_position=r.position,
                classification=str(r.position or ""),
                q1_s=r.q1_s,
                q2_s=r.q2_s,
                q3_s=r.q3_s,
            )
        )
    _upsert_entries(
        entries,
        ["team", "car_number", "finish_position", "classification", "q1_s", "q2_s", "q3_s"],
    )
    report.add("qualifying_results", len(entries))


RESULT_COLUMNS = (
    "grid_position",
    "finish_position",
    "classification",
    "status",
    "points",
    "laps_completed",
    "race_time_s",
    "fastest_lap_rank",
    "fastest_lap_s",
)


def _upsert_entries(entries: list[SessionEntry], fields: list[str]) -> None:
    """Upsert on (session, driver), touching only ``fields`` so timing-only columns of
    timed sessions (team colour, media id) survive."""
    if entries:
        SessionEntry.objects.bulk_create(
            entries,
            update_conflicts=True,
            unique_fields=["session", "driver"],
            update_fields=fields,
            batch_size=500,
        )


class _Taken:
    """Entries are unique per (session, driver) and (session, car). In the 1950s a car
    could be shared by two drivers, or one driver could take over a team-mate's car; those
    extra rows are skipped and reported instead of breaking the import."""

    def __init__(self, session: Session) -> None:
        rows = SessionEntry.objects.filter(session=session).values_list("driver_id", "car_number")
        self.car_of = dict(rows)

    def allows(self, driver_id: int, car: int) -> bool:
        owner = next((d for d, c in self.car_of.items() if c == car), None)
        if owner is not None and owner != driver_id:
            return False
        if driver_id in self.car_of and self.car_of[driver_id] != car:
            return False
        self.car_of[driver_id] = car
        return True


def _write_standings(season: int, rows: list[StandingRecord], report: IngestReport) -> None:
    """Replace the season's tables for the rounds fetched (idempotent, one bulk insert)."""
    season_obj = Season.objects.get(year=season)
    drivers = dict(Driver.objects.values_list("ref", "pk"))
    teams = dict(Team.objects.values_list("ref", "pk"))
    lines: list[Standing] = []
    for r in rows:
        is_team = r.competitor_id.startswith(_CONSTRUCTOR_TAG)
        ref = r.competitor_id.removeprefix(_CONSTRUCTOR_TAG)
        target = teams.get(ref) if is_team else drivers.get(ref)
        if target is None:
            report.skipped.append(f"standing for unknown {'team' if is_team else 'driver'} {ref}")
            continue
        lines.append(
            Standing(
                season=season_obj,
                round=r.round,
                team_id=target if is_team else None,
                driver_id=None if is_team else target,
                position=r.position,
                position_text=r.position_text,
                points=r.points,
                wins=r.wins,
            )
        )
    Standing.objects.filter(season=season_obj, round__in={r.round for r in rows}).delete()
    Standing.objects.bulk_create(lines, batch_size=500)
    report.add("standings", len(lines))
