import pytest
from rest_framework.test import APIClient

from stintline.racing.geometry import (
    CARD_BOX,
    CARD_POINTS,
    OUTLINE_BOX,
    OUTLINE_PADDING,
    card_path,
    normalise_outline,
)
from stintline.racing.models import Session, SessionKind, TrackOutline


def test_normalise_outline_keeps_aspect_ratio_and_flips_y() -> None:
    shape = normalise_outline([[0, 0], [200, 0], [200, 100]])

    assert shape.width == OUTLINE_BOX
    assert shape.height == pytest.approx(OUTLINE_BOX / 2 + OUTLINE_PADDING, abs=1)
    assert shape.points[0] == [OUTLINE_PADDING, 500.0]
    assert shape.points[2][1] == OUTLINE_PADDING


def test_normalise_outline_needs_two_points() -> None:
    with pytest.raises(ValueError, match="two points"):
        normalise_outline([[1, 1]])


@pytest.mark.django_db
def test_seed_stores_one_outline_per_race(seeded: None) -> None:
    outlines = TrackOutline.objects.select_related("session__event")

    assert outlines.count() == 3
    hungary = outlines.get(session__event__round=14)
    assert (hungary.car_number, hungary.lap_number) == (63, 45)
    assert 250 < len(hungary.points) < 400


@pytest.mark.django_db
def test_track_endpoint_returns_screen_coordinates(seeded: None) -> None:
    session = Session.objects.get(event__round=14, kind=SessionKind.RACE)

    response = APIClient().get(f"/api/v1/sessions/{session.pk}/track")

    assert response.status_code == 200
    body = response.json()
    assert max(body["width"], body["height"]) == OUTLINE_BOX
    assert all(0 <= x <= body["width"] and 0 <= y <= body["height"] for x, y in body["points"])
    assert body["lap_time_s"] == pytest.approx(79.409)
    assert response["ETag"]


@pytest.mark.django_db
def test_track_endpoint_is_404_without_outline(seeded: None) -> None:
    session = Session.objects.get(event__round=14, kind=SessionKind.RACE)
    TrackOutline.objects.filter(session=session).delete()

    response = APIClient().get(f"/api/v1/sessions/{session.pk}/track")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_card_path_is_closed_and_fits_the_card_box() -> None:
    points = [[x, (x * 7) % 50] for x in range(1000)]

    path = card_path(points)

    coords = [float(v) for v in path.strip("MZ ").replace("L", "").split()]
    assert path.startswith("M")
    assert path.endswith(" Z")
    assert len(coords) // 2 <= CARD_POINTS
    assert max(coords) <= CARD_BOX
