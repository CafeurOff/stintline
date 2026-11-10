"""News: headlines from recorded feeds, and race reports from the 2025 demo data."""

from __future__ import annotations

import dataclasses
import datetime as dt
from io import StringIO
from typing import Any
from unittest import mock

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient

from racedata.models import Headline as HeadlineDTO
from racedata.sources import build_fixture_sources
from stintline.news import reports, services, tasks
from stintline.news.models import Headline
from stintline.racing.models import Session, SessionKind, Standing, TrackStatus
from stintline.racing.tests.factories import (
    DriverFactory,
    SessionEntryFactory,
    SessionFactory,
)

pytestmark = pytest.mark.django_db
NOW = dt.datetime(2026, 11, 11, 12, tzinfo=dt.UTC)


def get(path: str, status: int = 200, **params: Any) -> Any:
    response = APIClient().get(f"/api/v1/{path}", params)
    assert response.status_code == status, response.content
    return response.json()


def headline(url: str, published_at: dt.datetime, language: str = "en") -> HeadlineDTO:
    return HeadlineDTO(
        source="autosport", language=language, title=url, url=url, published_at=published_at
    )


# Headlines


def test_refresh_headlines_stores_every_recorded_feed() -> None:
    sources = build_fixture_sources()

    created = services.refresh_headlines(sources, NOW)

    assert created == 48
    assert set(Headline.objects.values_list("source", flat=True)) == {
        "autosport",
        "racefans",
        "f1i",
        "motorsport-fr",
    }


def test_refresh_headlines_is_idempotent() -> None:
    sources = build_fixture_sources()
    services.refresh_headlines(sources, NOW)

    created = services.refresh_headlines(sources, NOW)

    assert created == 0
    assert Headline.objects.count() == 48


def test_refresh_headlines_without_a_news_source_does_nothing() -> None:
    sources = dataclasses.replace(build_fixture_sources(), news=None)

    assert services.refresh_headlines(sources, NOW) == 0


def test_store_headlines_drops_headlines_past_retention() -> None:
    services.store_headlines([headline("https://e.org/old", NOW - dt.timedelta(days=40))], NOW)

    services.store_headlines([headline("https://e.org/new", NOW)], NOW)

    assert list(Headline.objects.values_list("url", flat=True)) == ["https://e.org/new"]


def test_headlines_endpoint_filters_by_language_newest_first() -> None:
    services.store_headlines(
        [
            headline("https://e.org/en-old", NOW - dt.timedelta(hours=2)),
            headline("https://e.org/en-new", NOW),
            headline("https://e.org/fr", NOW, language="fr"),
        ],
        NOW,
    )

    body = get("news/headlines", lang="en")

    assert [h["url"] for h in body] == ["https://e.org/en-new", "https://e.org/en-old"]
    assert body[0]["source_name"] == "Autosport"
    assert len(get("news/headlines", limit=1)) == 1


def test_headlines_endpoint_rejects_unknown_languages() -> None:
    body = get("news/headlines", status=400, lang="de")

    assert body["status"] == 400


def test_refresh_task_and_command_read_the_feeds(settings: Any) -> None:
    settings.RACEDATA = {**settings.RACEDATA, "MODE": "fixtures"}

    assert tasks.refresh_headlines() == 48
    out = StringIO()
    call_command("refresh_news", stdout=out)

    assert "0 new headlines" in out.getvalue()


def test_worker_start_also_refreshes_headlines() -> None:
    from config.celery import catch_up_on_start

    sender = mock.Mock()

    catch_up_on_start(sender)

    sent = [c.args[0] for c in sender.app.send_task.call_args_list]
    assert "stintline.news.tasks.refresh_headlines" in sent


# Race reports


def test_reports_list_latest_races_and_sprints_first(seeded: None) -> None:
    body = get("news/reports", limit=3)

    assert [(r["event"]["name"], r["kind"]) for r in body] == [
        ("Abu Dhabi Grand Prix", "R"),
        ("Qatar Grand Prix", "R"),
        ("Qatar Grand Prix", "SPRINT"),
    ]


def test_race_report_with_timing_has_strategy_and_neutralisations(seeded: None) -> None:
    hungary = Session.objects.get(event__season__year=2025, event__round=14, kind="R")

    body = get(f"news/reports/{hungary.pk}")

    assert body["winner"]["driver"]["code"] == "NOR"
    assert body["podium"][1]["gap_s"] == pytest.approx(0.698, abs=0.01)
    assert body["winner_strategy"]["stops"] >= 1
    assert body["neutralisations"] == {"safety_cars": 0, "virtual_safety_cars": 0, "red_flags": 0}
    assert body["championship"]["leader"]["code"] == "PIA"
    assert body["championship"]["round"] == 14
    assert body["fastest_lap"] is not None
    assert body["rain"] is False


def test_report_without_timing_leaves_timing_facts_empty(seeded: None) -> None:
    body = get("news/reports", limit=1)[0]

    assert body["winner_strategy"] is None
    assert body["neutralisations"] is None
    assert body["rain"] is None
    assert body["winner_wins"] >= 1


def test_sprint_report_has_no_championship_or_win_count(seeded: None) -> None:
    sprint = get("news/reports", limit=3)[2]

    assert sprint["championship"] is None
    assert sprint["winner_wins"] is None


def test_report_detail_is_404_without_a_winner(seeded: None) -> None:
    future = SessionFactory.create(kind=SessionKind.RACE, event__round=99)

    body = get(f"news/reports/{future.pk}", status=404)

    assert body["status"] == 404


def _race(*rows: tuple[int | None, int | None, str, int, float | None]) -> Session:
    """Entries as (grid, finish, positionText, laps, race time)."""
    session = SessionFactory.create(kind=SessionKind.RACE)
    for index, (grid, finish, text, laps, time_s) in enumerate(rows):
        SessionEntryFactory.create(
            session=session,
            car_number=index + 1,
            grid_position=grid,
            finish_position=finish,
            classification=text,
            laps_completed=laps,
            race_time_s=time_s,
            fastest_lap_rank=1 if index == 1 else None,
        )
    return session


def test_report_facts_cover_lapped_cars_climbs_and_retirements() -> None:
    session = _race(
        (2, 1, "1", 50, 5000.0),
        (1, 2, "2", 50, 5003.25),
        (3, 3, "3", 49, None),
        (12, 4, "4", 49, None),
        (0, 5, "5", 49, None),
        (4, None, "R", 20, None),
    )

    facts = reports.build(session)

    assert facts is not None
    assert [(p.gap_s, p.laps_down) for p in facts["podium"]] == [(None, 0), (3.25, 0), (None, 1)]
    assert facts["biggest_gain"].car_number == 4
    assert [e.car_number for e in facts["retirements"]] == [6]
    assert facts["fastest_lap"].car_number == 2
    assert facts["starters"] == 6
    assert facts["classified"] == 5


def test_report_marks_a_new_championship_leader() -> None:
    session = _race((1, 1, "1", 50, 5000.0), (2, 2, "2", 50, 5001.0))
    event = session.event
    first, second = DriverFactory.create(), DriverFactory.create()
    for round_, leader, chaser in ((event.round - 1, second, first), (event.round, first, second)):
        Standing.objects.create(
            season=event.season, round=round_, driver=leader, position=1, points=30
        )
        Standing.objects.create(
            season=event.season, round=round_, driver=chaser, position=2, points=25
        )

    facts = reports.build(session)

    assert facts is not None
    assert facts["championship"]["leader_changed"] is True
    assert facts["championship"]["lead"] == 5


def test_report_counts_neutralisations_when_timing_exists() -> None:
    session = _race((1, 1, "1", 50, 5000.0))
    session.race_control.create(occurred_at=NOW, category="Other", message="GREEN", digest="x")
    for minutes, status in enumerate(("SC", "SC", "VSC")):
        TrackStatus.objects.create(
            session=session, status=status, started_at=NOW + dt.timedelta(minutes=minutes)
        )

    facts = reports.build(session)

    assert facts is not None
    assert facts["neutralisations"] == {"safety_cars": 2, "virtual_safety_cars": 1, "red_flags": 0}


def test_finished_at_falls_back_to_race_day() -> None:
    session = SessionFactory.create(ends_at=None, scheduled_start=None)

    assert reports.finished_at(session) == dt.datetime.combine(
        session.event.race_date, dt.time(), tzinfo=dt.UTC
    )


def test_report_borrows_team_colours_from_timing(seeded: None) -> None:
    body = get("news/reports", limit=1)[0]

    assert body["winner"]["team_colour"] != ""


def test_report_notes_rain_from_the_weather_samples() -> None:
    session = _race((1, 1, "1", 50, 5000.0))
    session.weather.create(sampled_at=NOW, rainfall=False)
    session.weather.create(sampled_at=NOW + dt.timedelta(minutes=1), rainfall=True)

    facts = reports.build(session)

    assert facts is not None
    assert facts["rain"] is True
