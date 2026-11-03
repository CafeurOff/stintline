import pytest
from rest_framework.test import APIClient

from racedata.sources import build_fixture_sources
from stintline.ingestion import history
from stintline.racing.models import Session, SessionKind

pytestmark = pytest.mark.django_db


def test_driver_career_totals_and_seasons(seeded: None) -> None:
    response = APIClient().get("/api/v1/drivers/norris")

    assert response.status_code == 200
    body = response.json()
    assert body["driver"]["nationality"] == "British"
    expected = {"starts": 24, "wins": 7, "podiums": 18, "poles": 7, "championships": 1}
    assert {key: body["totals"][key] for key in expected} == expected
    assert body["totals"]["points"] == 423.0
    assert body["seasons"] == [
        {
            "year": 2025,
            "teams": ["McLaren"],
            "starts": 24,
            "wins": 7,
            "podiums": 18,
            "points": 423.0,
            "championship_position": 1,
        }
    ]
    assert body["media"]["driver_image_url"].startswith("https://media.formula1.com/")
    assert response["ETag"]


def test_retired_driver_career_from_history() -> None:
    history.ingest_season_results(1950, build_fixture_sources())

    body = APIClient().get("/api/v1/drivers/farina").json()

    assert body["totals"]["championships"] == 1
    assert body["totals"]["first_season"] == 1950
    assert body["media"] is None
    assert body["totals"]["poles"] >= 1  # first on the grid: no qualifying stored in 1950
    assert body["totals"]["fastest_laps"] is None  # no fastest-lap data before 2004


def test_unknown_driver_is_404(db: None) -> None:
    response = APIClient().get("/api/v1/drivers/nobody")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_driver_results_filtered_by_season(seeded: None) -> None:
    body = APIClient().get("/api/v1/drivers/norris/results", {"season": 2025}).json()

    assert body["count"] == 30  # 24 races and 6 sprints
    last = body["results"][0]
    assert (last["event_name"], last["kind"], last["finish_position"]) == (
        "Abu Dhabi Grand Prix",
        "R",
        3,
    )


def test_driver_search_and_season_filter(seeded: None) -> None:
    client = APIClient()

    by_name = client.get("/api/v1/drivers", {"search": "max verst"}).json()
    by_code = client.get("/api/v1/drivers", {"search": "NOR"}).json()
    season = client.get("/api/v1/drivers", {"season": 2025}).json()

    assert [d["ref"] for d in by_name["results"]] == ["max_verstappen"]
    assert "norris" in [d["ref"] for d in by_code["results"]]
    assert season["count"] == 21
    assert client.get("/api/v1/drivers", {"season": 1800}).status_code == 400


def test_standings_after_latest_and_given_round(seeded: None) -> None:
    client = APIClient()

    final = client.get("/api/v1/seasons/2025/standings").json()
    hungary = client.get("/api/v1/seasons/2025/standings", {"round": 14}).json()

    assert final["round"] == 24
    assert final["rounds"] == list(range(1, 25))
    assert (final["drivers"][0]["driver"]["ref"], final["drivers"][0]["points"]) == (
        "norris",
        423.0,
    )
    assert final["constructors"][0]["team"]["ref"] == "mclaren"
    assert hungary["drivers"][0]["driver"]["ref"] == "piastri"


def test_standings_404_for_a_season_without_tables(db: None) -> None:
    response = APIClient().get("/api/v1/seasons/1949/standings")

    assert response.status_code == 404


def test_team_radio_list(seeded: None) -> None:
    session = Session.objects.get(event__season__year=2025, event__round=14, kind=SessionKind.RACE)

    body = APIClient().get(f"/api/v1/sessions/{session.pk}/radio").json()

    assert len(body) == 37
    assert body[0]["url"].endswith(".mp3")
    assert body == sorted(body, key=lambda r: r["recorded_at"])


def test_session_detail_exposes_qualifying_times(seeded: None) -> None:
    session = Session.objects.get(
        event__season__year=2025, event__round=14, kind=SessionKind.QUALIFYING
    )

    entries = APIClient().get(f"/api/v1/sessions/{session.pk}").json()["entries"]

    pole = next(e for e in entries if e["finish_position"] == 1)
    assert pole["driver"]["ref"] == "leclerc"
    assert pole["q3_s"] is not None
