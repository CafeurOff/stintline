"""Career statistics computed from stored classifications (read-only queries).

Definitions (documented because sources disagree on edge cases):
- start: a race entry not marked withdrawn (``W``) or failed to qualify (``F``/``DNQ``).
- pole: first in qualifying; for events without a qualifying session (most seasons before
  1994 in the data), first on the grid.
- championship: first in the drivers' table after the last round stored for that season.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from django.db.models import Case, Max, Q, QuerySet, When

from stintline.racing.media import media_for
from stintline.racing.models import Driver, SessionEntry, SessionKind, Standing

NOT_STARTED = ("W", "F", "DNQ", "DNPQ", "EX")
FASTEST_LAP_DATA_FROM = 2004
"""First season with fastest-lap ranks in Jolpica. Careers starting earlier get ``None``
rather than an undercount."""


@dataclass
class SeasonLine:
    year: int
    teams: list[str] = field(default_factory=list)
    starts: int = 0
    wins: int = 0
    podiums: int = 0
    points: float = 0.0
    championship_position: int | None = None


def _starts(entries: QuerySet[SessionEntry]) -> QuerySet[SessionEntry]:
    return entries.exclude(classification__in=NOT_STARTED)


def driver_career(driver: Driver) -> dict[str, Any]:
    races = SessionEntry.objects.filter(driver=driver, session__kind=SessionKind.RACE)
    scored = SessionEntry.objects.filter(
        driver=driver, session__kind__in=[SessionKind.RACE, SessionKind.SPRINT]
    )
    started = _starts(races)
    quali_poles = SessionEntry.objects.filter(
        driver=driver, session__kind=SessionKind.QUALIFYING, finish_position=1
    ).count()
    grid_poles = (
        races.filter(grid_position=1)
        .exclude(session__event__sessions__kind=SessionKind.QUALIFYING)
        .count()
    )

    seasons: dict[int, SeasonLine] = {}
    rows = scored.select_related("session__event__season", "team").order_by(
        "session__event__season__year", "session__event__round"
    )
    for entry in rows:
        year = entry.session.event.season.year
        line = seasons.setdefault(year, SeasonLine(year=year))
        if entry.team.name not in line.teams:
            line.teams.append(entry.team.name)
        line.points += entry.points
        if entry.session.kind == SessionKind.RACE and entry.classification not in NOT_STARTED:
            line.starts += 1
            line.wins += entry.finish_position == 1
            line.podiums += entry.finish_position is not None and entry.finish_position <= 3

    titles = 0
    for year, position in final_positions(driver).items():
        if year in seasons:
            seasons[year].championship_position = position
        titles += position == 1

    finishes = started.exclude(finish_position__isnull=True)
    latest_media = (
        SessionEntry.objects.filter(driver=driver)
        .exclude(media_id="")
        .select_related("session__event__season")
        .order_by("-session__event__race_date")
        .first()
    )
    media = (
        media_for(
            latest_media.session.event.season.year,
            latest_media.team_display_name,
            latest_media.media_id,
        )
        if latest_media
        else None
    )
    years = sorted(seasons)
    latest = (
        SessionEntry.objects.filter(
            driver=driver, session__kind__in=[SessionKind.RACE, SessionKind.SPRINT]
        )
        .select_related("team")
        .order_by("-session__event__race_date")
        .first()
    )
    colour = (
        SessionEntry.objects.filter(driver=driver)
        .exclude(team_colour="")
        .order_by("-session__event__race_date")
        .values_list("team_colour", flat=True)
        .first()
    )
    return {
        "driver": driver,
        "media": media,
        "latest_team": (
            {"ref": latest.team.ref, "name": latest.team.name, "colour": colour} if latest else None
        ),
        "latest_car_number": latest.car_number if latest else None,
        "totals": {
            "seasons": len(years),
            "first_season": years[0] if years else None,
            "last_season": years[-1] if years else None,
            "starts": started.count(),
            "wins": finishes.filter(finish_position=1).count(),
            "podiums": finishes.filter(finish_position__lte=3).count(),
            "poles": quali_poles + grid_poles,
            "fastest_laps": (
                races.filter(fastest_lap_rank=1).count()
                if years and years[0] >= FASTEST_LAP_DATA_FROM
                else None
            ),
            "points": round(sum(line.points for line in seasons.values()), 2),
            "championships": titles,
            "best_finish": finishes.order_by("finish_position")
            .values_list("finish_position", flat=True)
            .first(),
        },
        "seasons": [seasons[y] for y in years],
    }


def final_positions(driver: Driver) -> dict[int, int]:
    """Championship position after the last stored round of each season."""
    last_round = dict(
        Standing.objects.filter(driver__isnull=False)
        .values("season__year")
        .annotate(last=Max("round"))
        .values_list("season__year", "last")
    )
    out: dict[int, int] = {}
    for year, round_, position in Standing.objects.filter(
        driver=driver, position__isnull=False
    ).values_list("season__year", "round", "position"):
        if last_round.get(year) == round_ and position is not None:
            out[year] = position
    return out


def driver_results(driver: Driver, season: int | None) -> QuerySet[SessionEntry]:
    entries = SessionEntry.objects.filter(
        driver=driver, session__kind__in=[SessionKind.RACE, SessionKind.SPRINT]
    )
    if season is not None:
        entries = entries.filter(session__event__season__year=season)
    return entries.select_related(
        "session__event__season", "session__event__circuit", "team"
    ).order_by("-session__event__race_date", "session__kind")


def search_drivers(text: str | None, season: int | None) -> QuerySet[Driver]:
    drivers = Driver.objects.all()
    if text:
        for word in text.split():
            drivers = drivers.filter(
                Q(given_name__icontains=word)
                | Q(family_name__icontains=word)
                | Q(code__iexact=word)
            )
    if season is not None:
        drivers = drivers.filter(entries__session__event__season__year=season).distinct()
    order: list[Any] = ["family_name", "given_name"]
    if text:
        # Surnames starting with the first word come first ("Ham" -> Hamilton, not Graham).
        first = text.split()[0]
        drivers = drivers.annotate(
            prefix=Case(When(family_name__istartswith=first, then=0), default=1)
        )
        order = ["prefix", *order]
    return drivers.select_related("portrait").order_by(*order)


def standings(season: int, round_: int | None) -> tuple[int | None, list[int], QuerySet[Standing]]:
    """Tables after ``round_`` (default: the latest stored round)."""
    rows = Standing.objects.filter(season__year=season)
    rounds = sorted(set(rows.values_list("round", flat=True)))
    chosen = round_ if round_ in rounds else (rounds[-1] if rounds else None)
    if chosen is None:
        return None, rounds, rows.none()
    return (
        chosen,
        rounds,
        rows.filter(round=chosen).select_related("driver__portrait", "team").order_by("position"),
    )
