"""Hub endpoints on the 2025 demo data: home, events, teams, drivers and progression."""

from __future__ import annotations

import datetime as dt
from typing import Any
from unittest import mock

import pytest
from rest_framework.test import APIClient

from racedata.sources import build_fixture_sources
from stintline.ingestion import history
from stintline.racing.models import Event

pytestmark = pytest.mark.django_db


def get(path: str, **params: Any) -> Any:
    response = APIClient().get(f"/api/v1/{path}", params)
    assert response.status_code == 200, response.content
    return response.json()


def test_home_shows_next_event_last_podium_and_leaders(seeded: None) -> None:
    summer = dt.datetime(2025, 8, 10, 12, tzinfo=dt.UTC)
    with mock.patch("django.utils.timezone.now", return_value=summer):
        body = get("home")

    assert body["season"] == 2025
    assert body["next_event"]["name"] == "Dutch Grand Prix"
    last = body["last_race"]
    assert last["event"]["name"] == "Hungarian Grand Prix"
    assert last["has_data"] is True
    assert [e["driver"]["code"] for e in last["podium"]] == ["NOR", "PIA", "RUS"]
    assert len(body["drivers"]) == 5
    assert body["drivers"][0]["driver"]["code"] == "NOR"
    assert body["constructors"][0]["team"]["ref"] == "mclaren"


def test_home_without_any_race_is_empty(db: None) -> None:
    body = get("home")

    assert body == {
        "season": None,
        "next_event": None,
        "last_race": None,
        "drivers": [],
        "constructors": [],
    }


def test_season_events_carry_the_race_winner(seeded: None) -> None:
    events = get("seasons/2025/events")["results"]

    abu_dhabi = events[-1]
    assert abu_dhabi["winner"]["driver"]["code"] == "VER"
    assert abu_dhabi["winner"]["driver"]["portrait_url"].startswith("https://")
    assert abu_dhabi["circuit"]["latitude"] is not None


def test_event_detail(seeded: None) -> None:
    hungary = Event.objects.get(season__year=2025, round=14)

    body = get(f"events/{hungary.pk}")

    assert body["name"] == "Hungarian Grand Prix"
    assert body["winner"]["driver"]["code"] == "NOR"
    assert any(s["kind"] == "R" and s["has_data"] for s in body["sessions"])


def test_unknown_event_is_404(db: None) -> None:
    assert APIClient().get("/api/v1/events/999999").status_code == 404


def test_team_career(seeded: None) -> None:
    body = get("teams/mclaren")

    assert body["team"]["name"] == "McLaren"
    assert body["colour"]
    assert body["totals"]["championships"] == 1
    assert body["totals"]["wins"] == 14
    season = body["seasons"][0]
    assert season["year"] == 2025
    assert sorted(d["code"] for d in season["drivers"]) == ["NOR", "PIA"]


def test_retired_team_career_from_history() -> None:
    history.ingest_season_results(1950, build_fixture_sources())

    body = get("teams/alfa")

    assert body["totals"]["first_season"] == 1950
    assert body["totals"]["wins"] >= 1
    assert body["colour"] is None


def test_team_list_filters_by_season(seeded: None) -> None:
    body = get("teams", season=2025)

    assert body["count"] == 10
    assert all(team["colour"] for team in body["results"])
    assert get("teams", search="ferr")["results"][0]["ref"] == "ferrari"


def test_unknown_team_is_404(db: None) -> None:
    assert APIClient().get("/api/v1/teams/nobody").status_code == 404


def test_driver_list_shows_portrait_and_team_of_the_season(seeded: None) -> None:
    body = get("drivers", season=2025)

    hamilton = next(d for d in body["results"] if d["ref"] == "hamilton")
    assert hamilton["team"]["ref"] == "ferrari"
    assert hamilton["portrait"]["license"]
    assert hamilton["portrait"]["artist"]


def test_progression_lists_points_after_every_round(seeded: None) -> None:
    body = get("seasons/2025/standings/progression")

    assert len(body["rounds"]) == 24
    assert body["rounds"][0] == {"round": 1, "name": "Australian Grand Prix"}
    leader = body["drivers"][0]
    assert leader["driver"]["code"] == "NOR"
    assert leader["points"][-1] == 423.0
    assert leader["positions"][-1] == 1
    assert body["constructors"][0]["team"]["ref"] == "mclaren"


def test_progression_of_an_empty_season_is_404(db: None) -> None:
    assert APIClient().get("/api/v1/seasons/1900/standings/progression").status_code == 404
