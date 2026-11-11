import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from stintline.racing.media import car_image_url, driver_image_url, media_for, team_media_slug
from stintline.racing.models import Session, SessionKind

pytestmark = pytest.mark.django_db


def race_id(round_: int) -> int:
    return Session.objects.get(event__round=round_, kind=SessionKind.RACE).pk


def test_seasons_and_events_navigation(seeded: None) -> None:
    client = APIClient()

    seasons = client.get("/api/v1/seasons").json()
    events = client.get("/api/v1/seasons/2025/events", {"limit": 30}).json()

    assert seasons["results"] == [{"year": 2025, "events_count": 24}]
    assert events["count"] == 24
    hungary = next(e for e in events["results"] if e["round"] == 14)
    assert hungary["circuit"]["ref"] == "hungaroring"
    race = next(s for s in hungary["sessions"] if s["kind"] == "R")
    assert race["has_data"] is True
    assert all(not s["has_data"] for s in hungary["sessions"] if s["kind"] != "R")


def test_events_are_paginated(seeded: None) -> None:
    page = APIClient().get("/api/v1/seasons/2025/events", {"limit": 5, "offset": 5}).json()

    assert len(page["results"]) == 5
    assert page["results"][0]["round"] == 6
    assert page["next"] is not None


def test_session_detail_with_entries_media_and_neutralisations(seeded: None) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(4)}")

    assert response.status_code == 200
    body = response.json()
    assert body["event"]["name"] == "Bahrain Grand Prix"
    assert body["total_laps"] == 57
    assert body["neutralisations"] == [{"status": "SC", "lap_start": 32, "lap_end": 35}]
    winner = body["entries"][0]
    assert winner["finish_position"] == 1
    assert winner["media"]["car_image_url"].endswith(".webp")
    assert "/common/f1/2025/" in winner["media"]["driver_image_url"]
    assert [e["finish_position"] for e in body["entries"] if e["finish_position"]] == sorted(
        e["finish_position"] for e in body["entries"] if e["finish_position"]
    )
    assert response["Cache-Control"].startswith("public")


def test_session_detail_supports_conditional_requests(seeded: None) -> None:
    client = APIClient()
    first = client.get(f"/api/v1/sessions/{race_id(14)}")

    second = client.get(f"/api/v1/sessions/{race_id(14)}", HTTP_IF_NONE_MATCH=first["ETag"])

    assert second.status_code == 304


@override_settings(OFFICIAL_MEDIA_ENABLED=False)
def test_media_can_be_switched_off(seeded: None) -> None:
    body = APIClient().get(f"/api/v1/sessions/{race_id(14)}").json()

    assert all(e["media"] is None for e in body["entries"])


def test_stints_endpoint(seeded: None) -> None:
    rows = APIClient().get(f"/api/v1/sessions/{race_id(14)}/stints").json()

    norris = next(r for r in rows if r["car_number"] == 4)
    assert [s["compound"] for s in norris["stints"]] == ["MEDIUM", "HARD"]
    assert norris["pit_stops"][0]["lap_number"] == 31
    assert len(rows) == 20


def test_unknown_session_is_404() -> None:
    response = APIClient().get("/api/v1/sessions/999999")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_media_url_builders() -> None:
    assert team_media_slug("Red Bull Racing") == "redbullracing"
    assert team_media_slug("Haas F1 Team") == "haasf1team"
    assert car_image_url(2025, "mclaren").endswith(
        "/common/f1/2025/mclaren/2025mclarencarright.webp"
    )
    assert driver_image_url(2025, "mclaren", "lannor01").endswith("2025mclarenlannor01right.webp")
    assert media_for(2025, "", "x") is None
    media = media_for(2025, "McLaren", "")
    assert media is not None
    assert media.driver_image_url is None


def test_calendar_events_carry_their_circuit_outline(seeded: None) -> None:
    events = APIClient().get("/api/v1/seasons/2025/events", {"limit": 30}).json()["results"]

    hungary = next(e for e in events if e["round"] == 14)
    never_timed = next(e for e in events if e["round"] == 1)
    assert hungary["circuit"]["outline"].startswith("M")
    assert hungary["circuit"]["outline"].endswith("Z")
    assert never_timed["circuit"]["outline"] is None


def test_driver_photo_is_the_latest_official_portrait(seeded: None) -> None:
    body = APIClient().get(f"/api/v1/sessions/{race_id(14)}").json()

    norris = next(e for e in body["entries"] if e["car_number"] == 4)
    assert norris["media"]["driver_image_url"] is not None
    assert norris["driver"]["photo_url"] == norris["media"]["driver_image_url"]


@override_settings(OFFICIAL_MEDIA_ENABLED=False)
def test_driver_photo_falls_back_to_wikipedia_without_official_media(seeded: None) -> None:
    body = APIClient().get(f"/api/v1/sessions/{race_id(14)}").json()

    assert all(e["driver"]["photo_url"] == e["driver"]["portrait_url"] for e in body["entries"])
