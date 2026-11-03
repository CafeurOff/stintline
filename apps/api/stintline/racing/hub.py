"""Read queries behind the fan hub pages: home summary, teams and championship progression.

Definitions follow :mod:`stintline.racing.careers` (starts exclude non-starters, a pole is
first in qualifying, or first on the grid when the event has no qualifying stored).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from django.db.models import Case, Exists, OuterRef, QuerySet, Subquery, When

from stintline.racing.careers import NOT_STARTED
from stintline.racing.models import (
    Driver,
    Event,
    Session,
    SessionEntry,
    SessionKind,
    Standing,
    Team,
)
from stintline.racing.selectors import ENTRY_ORDER, season_events

HOME_TABLE_SIZE = 5
"""Lines of each championship table on the home page."""
PODIUM = 3


def _latest_colour(team: Any, season: int | None = None) -> Subquery:
    """Most recent non-empty timing colour of a team (OpenF1, 2023+)."""
    entries = SessionEntry.objects.filter(team=team).exclude(team_colour="")
    if season is not None:
        entries = entries.filter(session__event__season__year=season)
    return Subquery(entries.order_by("-session__event__race_date").values("team_colour")[:1])


def with_team_colour(teams: QuerySet[Team]) -> QuerySet[Team]:
    return teams.annotate(colour=_latest_colour(OuterRef("pk")))


def with_latest_team(drivers: QuerySet[Driver], season: int | None) -> QuerySet[Driver]:
    """Annotate each driver with the team of their latest race (in ``season`` if given)."""
    entries = SessionEntry.objects.filter(
        driver=OuterRef("pk"), session__kind__in=[SessionKind.RACE, SessionKind.SPRINT]
    )
    if season is not None:
        entries = entries.filter(session__event__season__year=season)
    latest = entries.order_by("-session__event__race_date", "-session__scheduled_start")
    return drivers.annotate(
        team_ref=Subquery(latest.values("team__ref")[:1]),
        team_name=Subquery(latest.values("team__name")[:1]),
        team_colour=Subquery(latest.exclude(team_colour="").values("team_colour")[:1]),
    )


def search_teams(text: str | None, season: int | None) -> QuerySet[Team]:
    teams = Team.objects.all()
    order: list[Any] = ["name"]
    if text:
        teams = teams.filter(name__icontains=text.strip()).annotate(
            prefix=Case(When(name__istartswith=text.strip(), then=0), default=1)
        )
        order = ["prefix", "name"]  # "Ferrari" before "Cooper-Ferrari"
    if season is not None:
        teams = teams.filter(entries__session__event__season__year=season).distinct()
    return with_team_colour(teams).order_by(*order)


@dataclass
class TeamSeason:
    year: int
    drivers: list[Driver] = field(default_factory=list)
    starts: int = 0
    wins: int = 0
    podiums: int = 0
    points: float = 0.0
    championship_position: int | None = None


def team_career(team: Team) -> dict[str, Any]:
    races = SessionEntry.objects.filter(team=team, session__kind=SessionKind.RACE).exclude(
        classification__in=NOT_STARTED
    )
    scored = SessionEntry.objects.filter(
        team=team, session__kind__in=[SessionKind.RACE, SessionKind.SPRINT]
    ).select_related("session__event__season", "driver__portrait")
    seasons: dict[int, TeamSeason] = {}
    for entry in scored.order_by("session__event__race_date", "finish_position"):
        line = seasons.setdefault(
            entry.session.event.season.year, TeamSeason(year=entry.session.event.season.year)
        )
        if entry.driver not in line.drivers:
            line.drivers.append(entry.driver)
        line.points += entry.points
        if entry.session.kind == SessionKind.RACE and entry.classification not in NOT_STARTED:
            line.starts += 1
            line.wins += entry.finish_position == 1
            line.podiums += entry.finish_position is not None and entry.finish_position <= PODIUM

    titles = 0
    for year, position in _final_positions(Standing.objects.filter(team=team)).items():
        if year in seasons:
            seasons[year].championship_position = position
        titles += position == 1

    poles = SessionEntry.objects.filter(
        team=team, session__kind=SessionKind.QUALIFYING, finish_position=1
    ).count() + (
        races.filter(grid_position=1)
        .exclude(session__event__sessions__kind=SessionKind.QUALIFYING)
        .count()
    )
    years = sorted(seasons)
    colour = (
        SessionEntry.objects.filter(team=team)
        .exclude(team_colour="")
        .order_by("-session__event__race_date")
        .values_list("team_colour", flat=True)
        .first()
    )
    return {
        "team": team,
        "colour": colour,
        "totals": {
            "seasons": len(years),
            "first_season": years[0] if years else None,
            "last_season": years[-1] if years else None,
            "starts": races.values("session").distinct().count(),
            "wins": races.filter(finish_position=1).count(),
            "podiums": races.filter(finish_position__lte=PODIUM).count(),
            "poles": poles,
            "points": round(sum(s.points for s in seasons.values()), 2),
            "championships": titles,
        },
        "seasons": [seasons[y] for y in reversed(years)],
    }


def _final_positions(rows: QuerySet[Standing]) -> dict[int, int]:
    """Position after the last stored round of each season, for one driver or team."""
    out: dict[int, tuple[int, int]] = {}
    for year, round_, position in rows.exclude(position__isnull=True).values_list(
        "season__year", "round", "position"
    ):
        if position is not None and (year not in out or round_ > out[year][0]):
            out[year] = (round_, position)
    return {year: position for year, (_, position) in out.items()}


def event_detail(event_id: int) -> Event:
    event = Event.objects.filter(pk=event_id).values_list("season__year", flat=True).first()
    if event is None:
        raise Event.DoesNotExist
    return season_events(event).get(pk=event_id)


def podium(session: Session) -> list[SessionEntry]:
    return list(
        session.entries.filter(finish_position__lte=PODIUM)
        .select_related("driver__portrait", "team", "session__event__season")
        .order_by(*ENTRY_ORDER)
    )


def home(today: date) -> dict[str, Any]:
    next_event = (
        Event.objects.filter(race_date__gte=today)
        .order_by("race_date")
        .values_list("pk", flat=True)
    ).first()
    classified = SessionEntry.objects.filter(session=OuterRef("pk"), finish_position=1)
    last_race = (
        Session.objects.filter(kind=SessionKind.RACE, event__race_date__lt=today)
        .filter(Exists(classified))
        .select_related("event__season", "event__circuit")
        .order_by("-event__race_date")
        .first()
    )
    season = last_race.event.season.year if last_race else None
    tables = _top_standings(season) if season is not None else ([], [])
    return {
        "season": season,
        "next_event": event_detail(next_event) if next_event is not None else None,
        "last_race": (
            {
                "session_id": last_race.pk,
                "event": last_race.event,
                "has_data": last_race.entries.filter(laps__isnull=False).exists(),
                "podium": podium(last_race),
            }
            if last_race
            else None
        ),
        "drivers": tables[0],
        "constructors": tables[1],
    }


def _top_standings(season: int) -> tuple[list[Standing], list[Standing]]:
    rows = Standing.objects.filter(season__year=season)
    last = rows.order_by("-round").values_list("round", flat=True).first()
    if last is None:
        return [], []
    latest = rows.filter(round=last).select_related("driver__portrait", "team").order_by("position")
    return (
        list(latest.filter(driver__isnull=False)[:HOME_TABLE_SIZE]),
        list(latest.filter(team__isnull=False)[:HOME_TABLE_SIZE]),
    )


def progression(season: int) -> dict[str, Any] | None:
    """Points of every driver and team after each stored round of ``season``."""
    rows = list(
        Standing.objects.filter(season__year=season)
        .select_related("driver__portrait", "team")
        .order_by("round", "position")
    )
    if not rows:
        return None
    rounds = sorted({r.round for r in rows})
    index = {round_: i for i, round_ in enumerate(rounds)}
    names = dict(
        Event.objects.filter(season__year=season, round__in=rounds).values_list("round", "name")
    )
    driver_colours = dict(
        SessionEntry.objects.filter(session__event__season__year=season)
        .exclude(team_colour="")
        .order_by("session__event__race_date")
        .values_list("driver_id", "team_colour")
    )
    team_colours = dict(
        SessionEntry.objects.filter(session__event__season__year=season)
        .exclude(team_colour="")
        .order_by("session__event__race_date")
        .values_list("team_id", "team_colour")
    )

    def series(by: str) -> list[dict[str, Any]]:
        lines: dict[int, dict[str, Any]] = {}
        for row in rows:
            subject = row.driver if by == "driver" else row.team
            if subject is None:
                continue
            line = lines.setdefault(
                subject.pk,
                {
                    by: subject,
                    "colour": (driver_colours if by == "driver" else team_colours).get(subject.pk),
                    "points": [None] * len(rounds),
                    "positions": [None] * len(rounds),
                },
            )
            line["points"][index[row.round]] = row.points
            line["positions"][index[row.round]] = row.position
        final = index[rounds[-1]]
        return sorted(
            lines.values(),
            key=lambda line: (line["positions"][final] is None, line["positions"][final] or 0),
        )

    return {
        "season": season,
        "rounds": [{"round": r, "name": names.get(r, "")} for r in rounds],
        "drivers": series("driver"),
        "constructors": series("team"),
    }
