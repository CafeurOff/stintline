"""Drivers' championship rules per season, as far as title maths needs them (ADR 0022).

Only three things decide who can still win: the most points one driver can take from a
Grand Prix (a win, plus the fastest-lap point in the seasons that had one), the most from a
sprint, and which results count. Until 1990 only a driver's best results counted, and from
1967 to 1980 the season was split in two halves with their own count.

Sources: the FIA's points systems as listed on Wikipedia ("List of Formula One points
systems"), checked against our stored results: recounting every driver's season with these
rules gives the official final standings (`check_title_rules`).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CountBlock:
    """A run of Grands Prix in race order and how many of their results count.

    ``races`` is ``None`` for "every race left"; ``best`` is ``None`` for "all of them".
    """

    races: int | None
    best: int | None


ALL_COUNT = (CountBlock(races=None, best=None),)


def best_of(results: int) -> tuple[CountBlock, ...]:
    return (CountBlock(races=None, best=results),)


def halves(first: tuple[int, int], last: tuple[int, int]) -> tuple[CountBlock, ...]:
    """Split season: (best, out of races) for the first half, then for the second."""
    return (
        CountBlock(races=first[1], best=first[0]),
        CountBlock(races=last[1], best=last[0]),
    )


@dataclass(frozen=True, slots=True)
class SeasonRules:
    """Attributes:
    race_max: most points one driver can score in a Grand Prix (win and fastest lap).
    sprint_max: most points from a sprint (0 before 2021).
    blocks: which Grand Prix results count, in race order. Sprint points always count.
    double_last_race: the final Grand Prix scored double (2014).
    """

    race_max: float
    sprint_max: float
    blocks: tuple[CountBlock, ...]
    double_last_race: bool = False

    @property
    def all_count(self) -> bool:
        return all(block.best is None for block in self.blocks)


# A win scored 8 until 1960, 9 from 1961 to 1990, 10 from 1991 to 2009 and 25 since 2010.
# The fastest lap scored 1 from 1950 to 1959 and from 2019 to 2024 (top ten only, which a
# winner always is).
_SPLIT_SEASONS: dict[int, tuple[tuple[int, int], tuple[int, int]]] = {
    1967: ((5, 6), (4, 5)),
    1968: ((5, 6), (5, 6)),
    1969: ((5, 6), (4, 5)),
    1970: ((6, 7), (5, 6)),
    1971: ((5, 6), (4, 5)),
    1972: ((5, 6), (5, 6)),
    1973: ((7, 8), (6, 7)),
    1974: ((7, 8), (6, 7)),
    1975: ((6, 7), (6, 7)),
    1976: ((7, 8), (7, 8)),
    1977: ((8, 9), (7, 8)),
    1978: ((7, 8), (7, 8)),
    1979: ((4, 7), (4, 8)),
    1980: ((5, 7), (5, 7)),
}
_BEST_RESULTS: dict[int, int] = {
    **dict.fromkeys(range(1950, 1954), 4),
    **dict.fromkeys(range(1954, 1958), 5),
    1958: 6,
    1959: 5,
    1960: 6,
    1961: 5,
    1962: 5,
    **dict.fromkeys(range(1963, 1966), 6),
    1966: 5,
    **dict.fromkeys(range(1981, 1991), 11),
}
FIRST_SEASON = 1950


class UnknownSeasonError(LookupError):
    """No championship before 1950."""


def _race_max(year: int) -> float:
    if year <= 1959:
        return 8 + 1
    if year == 1960:
        return 8
    if year <= 1990:
        return 9
    if year <= 2009:
        return 10
    if 2019 <= year <= 2024:
        return 25 + 1
    return 25


def _sprint_max(year: int) -> float:
    if year < 2021:
        return 0
    return 3 if year == 2021 else 8


def rules_for(year: int) -> SeasonRules:
    if year < FIRST_SEASON:
        raise UnknownSeasonError(f"no championship in {year}")
    if year in _SPLIT_SEASONS:
        first, last = _SPLIT_SEASONS[year]
        blocks = halves(first, last)
    elif year in _BEST_RESULTS:
        blocks = best_of(_BEST_RESULTS[year])
    else:
        blocks = ALL_COUNT
    return SeasonRules(
        race_max=_race_max(year),
        sprint_max=_sprint_max(year),
        blocks=blocks,
        double_last_race=year == 2014,
    )
