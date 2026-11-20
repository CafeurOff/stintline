"""What each web page is about, for its HTML head (ADR 0025).

The web app is rendered in the browser; link previews and some crawlers never run its
JavaScript. For every route of `apps/web/src/app/router.tsx` this module gives the title, the
description and the structured data, read from stored data, in English and French. An
unknown path, or a path naming something we do not have, is a 404.
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any, Literal

from django.conf import settings

from stintline.racing.models import Circuit, Driver, Event, Session, Team

Locale = Literal["en", "fr"]
SITE_NAME = "StintLine"


@dataclass(frozen=True, slots=True)
class Text:
    en: str
    fr: str

    def __call__(self, locale: Locale) -> str:
        return self.fr if locale == "fr" else self.en


@dataclass(frozen=True, slots=True)
class PageMeta:
    title: Text
    """Page title without the site name; empty for the home page."""
    description: Text
    json_ld: dict[str, Any] | None = None
    image_path: str | None = None
    """Our own picture for link previews (a relayed portrait), as a path."""
    kind: str = "website"
    preloads: tuple[str, ...] = field(default=())
    """API paths the page requests first (ADR 0025, preload hints)."""


SITE = Text(
    "Formula 1 race strategy and history: every Grand Prix since 1950, race replays, tyre "
    "strategies, pit stops, telemetry and live timing. An unofficial fan project.",
    "La stratégie et l'histoire de la Formule 1 : chaque Grand Prix depuis 1950, courses "
    "rejouées, stratégies de pneus, arrêts au stand, télémétrie et direct. Projet de fan "
    "non officiel.",
)


@cache
def _event_names_fr() -> dict[str, str]:
    path = Path(settings.EVENT_NAMES_FR_PATH)
    try:
        names: dict[str, str] = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    return names


def event_name(name: str) -> Text:
    return Text(name, _event_names_fr().get(name, name))


def _static(title_en: str, title_fr: str, desc_en: str, desc_fr: str) -> PageMeta:
    return PageMeta(Text(title_en, title_fr), Text(desc_en, desc_fr))


STATIC: dict[str, PageMeta] = {
    "": PageMeta(Text("", ""), SITE, json_ld={"@type": "WebSite", "name": SITE_NAME}),
    "drivers": _static(
        "Drivers",
        "Pilotes",
        "Every Formula 1 driver since 1950, season by season, with photos and careers.",
        "Tous les pilotes de Formule 1 depuis 1950, saison par saison, avec photos et carrières.",
    ),
    "teams": _static(
        "Teams",
        "Écuries",
        "Every Formula 1 team since 1950: line-ups, cars, wins and seasons.",
        "Toutes les écuries de Formule 1 depuis 1950 : pilotes, voitures, victoires et saisons.",
    ),
    "calendar": _static(
        "Calendar",
        "Calendrier",
        "The Formula 1 calendar, with results and the circuit of every Grand Prix.",
        "Le calendrier de la Formule 1, avec les résultats et le circuit de chaque Grand Prix.",
    ),
    "standings": _static(
        "Standings",
        "Classements",
        "Drivers' and constructors' championships, round by round, with the title maths.",
        "Championnats pilotes et constructeurs, manche après manche, avec le calcul du titre.",
    ),
    "live": _static(
        "Live",
        "Direct",
        "Live timing during Grands Prix: running order, gaps, tyres, pit stops and team radio.",
        "Le direct des Grands Prix : classement, écarts, pneus, arrêts au stand et radios.",
    ),
    "news": _static(
        "News",
        "Actualités",
        "Race reports written from the timing data, and Formula 1 headlines.",
        "Comptes rendus écrits à partir des chronos, et les titres de l'actualité de la F1.",
    ),
    "analysis": _static(
        "Head to head",
        "Duels",
        "Teammate duels and any two drivers compared, race by race, since 1950.",
        "Les duels entre coéquipiers et deux pilotes comparés course par course depuis 1950.",
    ),
    "analysis/pace": _static(
        "Race pace",
        "Rythme de course",
        "Race pace of every driver, with fuel-corrected lap times and box plots.",
        "Le rythme de course de chaque pilote, tours corrigés du carburant et boîtes à moustaches.",
    ),
    "analysis/consistency": _static(
        "Consistency",
        "Régularité",
        "How consistent each driver's laps are once tyre wear is removed.",
        "La régularité des tours de chaque pilote une fois l'usure des pneus retirée.",
    ),
    "analysis/pit-stops": _static(
        "Pit stops",
        "Arrêts au stand",
        "Fastest pit crews, pit loss per circuit and undercuts that worked.",
        "Les équipes les plus rapides au stand, la perte au stand par circuit et les undercuts.",
    ),
    "circuits": _static(
        "Circuits",
        "Circuits",
        "Every circuit's profile: lap, top speed, pit loss, overtaking and records.",
        "Le profil de chaque circuit : tour, vitesse de pointe, perte au stand, dépassements.",
    ),
    "documents": _static(
        "FIA documents",
        "Documents FIA",
        "FIA documents and stewards' decisions, searchable and linked to the race.",
        "Les documents de la FIA et les décisions des commissaires, liés à la course.",
    ),
    "technical": _static(
        "Technical",
        "Technique",
        "Car upgrades, power-unit elements and incidents read from FIA documents.",
        "Évolutions des voitures, éléments moteur et incidents lus dans les documents FIA.",
    ),
    "model": _static(
        "How it works",
        "Comment ça marche",
        "How StintLine models tyre wear, fuel, pit loss and undercuts, tested on real races.",
        "Comment StintLine modélise l'usure, le carburant, la perte au stand et l'undercut.",
    ),
}


def _season(year: str, base: PageMeta, en: str, fr: str) -> PageMeta:
    return PageMeta(Text(f"{year} {en}", f"{fr} {year}"), base.description)


def _event(event_id: str) -> PageMeta | None:
    event = Event.objects.select_related("season", "circuit").filter(pk=int(event_id)).first()
    if event is None:
        return None
    year = event.season.year
    name = event_name(event.name)
    circuit = event.circuit
    return PageMeta(
        Text(f"{name.en} {year}", f"{name.fr} {year}"),
        Text(
            f"Results, race analysis and strategy of the {year} {name.en} at {circuit.name}, "
            f"{circuit.country}.",
            f"Résultats, analyse et stratégie du {name.fr} {year} sur le circuit "
            f"{circuit.name} ({circuit.country}).",
        ),
        json_ld={
            "@type": "SportsEvent",
            "name": f"{name.en} {year}",
            "sport": "Formula 1",
            "startDate": event.race_date.isoformat(),
            "location": {
                "@type": "Place",
                "name": circuit.name,
                "address": f"{circuit.locality}, {circuit.country}",
            },
        },
        kind="article",
        preloads=(f"/api/v1/events/{event.pk}",),
    )


def _session(session_id: str, view: Text) -> PageMeta | None:
    session = Session.objects.select_related("event__season").filter(pk=int(session_id)).first()
    if session is None:
        return None
    name = event_name(session.event.name)
    year = session.event.season.year
    return PageMeta(
        Text(f"{name.en} {year} · {view.en}", f"{name.fr} {year} · {view.fr}"),
        Text(
            f"The {year} {name.en} replayed on the circuit, with pit-stop, undercut and "
            "strategy simulations.",
            f"Le {name.fr} {year} rejoué sur le circuit, avec les simulations d'arrêt, "
            "d'undercut et de stratégie.",
        ),
        kind="article",
    )


def _driver(ref: str) -> PageMeta | None:
    driver = Driver.objects.select_related("portrait").filter(ref=ref).first()
    if driver is None:
        return None
    name = f"{driver.given_name} {driver.family_name}"
    person: dict[str, Any] = {"@type": "Person", "name": name, "jobTitle": "Racing driver"}
    if driver.nationality:
        person["nationality"] = driver.nationality
    if driver.date_of_birth:
        person["birthDate"] = driver.date_of_birth.isoformat()
    if driver.wikipedia_url:
        person["sameAs"] = driver.wikipedia_url
    has_portrait = hasattr(driver, "portrait")
    return PageMeta(
        Text(name, name),
        Text(
            f"{name}'s Formula 1 career: seasons, results, wins, podiums and teammates.",
            f"La carrière de {name} en Formule 1 : saisons, résultats, victoires et podiums.",
        ),
        json_ld=person,
        image_path=f"/api/v1/drivers/{driver.ref}/portrait" if has_portrait else None,
        kind="profile",
        preloads=(f"/api/v1/drivers/{driver.ref}",),
    )


def _team(ref: str) -> PageMeta | None:
    team = Team.objects.filter(ref=ref).first()
    if team is None:
        return None
    return PageMeta(
        Text(team.name, team.name),
        Text(
            f"{team.name} in Formula 1: seasons, drivers, wins and championships.",
            f"{team.name} en Formule 1 : saisons, pilotes, victoires et titres.",
        ),
        json_ld={"@type": "SportsTeam", "name": team.name, "sport": "Formula 1"},
    )


def _circuit(ref: str) -> PageMeta | None:
    circuit = Circuit.objects.filter(ref=ref).first()
    if circuit is None:
        return None
    return PageMeta(
        Text(circuit.name, circuit.name),
        Text(
            f"{circuit.name} ({circuit.locality}, {circuit.country}): lap, top speed, pit "
            "loss, overtaking and records.",
            f"{circuit.name} ({circuit.locality}, {circuit.country}) : tour, vitesse de "
            "pointe, perte au stand, dépassements et records.",
        ),
        json_ld={
            "@type": "Place",
            "name": circuit.name,
            "address": f"{circuit.locality}, {circuit.country}",
        },
    )


def _report(session_id: str) -> PageMeta | None:
    session = Session.objects.select_related("event__season").filter(pk=int(session_id)).first()
    if session is None:
        return None
    name = event_name(session.event.name)
    year = session.event.season.year
    return PageMeta(
        Text(f"{name.en} {year}: race report", f"{name.fr} {year} : compte rendu"),
        Text(
            f"The story of the {year} {name.en}, written from the timing data.",
            f"Le récit du {name.fr} {year}, écrit à partir des chronos.",
        ),
        kind="article",
    )


TYRES = Text("Tyres", "Pneus")
CIRCUIT_VIEW = Text("Circuit", "Circuit")

Resolver = Callable[..., PageMeta | None]
ROUTES: tuple[tuple[re.Pattern[str], Resolver], ...] = (
    (
        re.compile(r"calendar/(\d{4})"),
        lambda y: _season(y, STATIC["calendar"], "calendar", "Calendrier"),
    ),
    (
        re.compile(r"standings/(\d{4})"),
        lambda y: _season(y, STATIC["standings"], "standings", "Classements"),
    ),
    (re.compile(r"events/(\d+)"), _event),
    (re.compile(r"sessions/(\d+)"), lambda s: _session(s, CIRCUIT_VIEW)),
    (re.compile(r"sessions/(\d+)/tyres"), lambda s: _session(s, TYRES)),
    (re.compile(r"drivers/([\w-]+)"), _driver),
    (re.compile(r"teams/([\w-]+)"), _team),
    (re.compile(r"circuits/([\w-]+)"), _circuit),
    (re.compile(r"news/(\d+)"), _report),
)


def describe(path: str) -> PageMeta | None:
    """The page at ``path`` (without the language prefix or slashes around it), or ``None``
    when there is no such page."""
    if path in STATIC:
        return STATIC[path]
    for pattern, resolve in ROUTES:
        match = pattern.fullmatch(path)
        if match:
            return resolve(*match.groups())
    return None
