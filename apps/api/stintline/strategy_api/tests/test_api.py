import pytest
from rest_framework.test import APIClient

from stintline.racing.models import Session, SessionKind
from stintline.strategy_api import services

pytestmark = pytest.mark.django_db


def race_id(round_: int) -> int:
    return Session.objects.get(event__round=round_, kind=SessionKind.RACE).pk


def test_laps_with_corrections_and_exclusions(seeded: None) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(14)}/laps", {"cars": "4,81"})

    assert response.status_code == 200
    laps = response.json()
    assert {lap["car_number"] for lap in laps} == {4, 81}
    first = next(lap for lap in laps if lap["car_number"] == 4 and lap["lap"] == 1)
    assert first["excluded"] == "first_lap"
    clean = next(lap for lap in laps if lap["car_number"] == 4 and lap["excluded"] is None)
    assert clean["corrected_time_s"] < clean["time_s"]
    assert response["ETag"]


@pytest.mark.parametrize("cars", ["", "a,b", "1,2,3,4,5"])
def test_laps_validates_the_car_filter(seeded: None, cars: str) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(14)}/laps", {"cars": cars})

    assert response.status_code == 400
    assert response.json()["code"] == "invalid"


def test_unknown_car_is_a_400(seeded: None) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(14)}/laps", {"cars": "99"})

    assert response.status_code == 400
    assert "unknown car" in str(response.json()["invalid_params"])


def test_degradation_and_pit_loss(seeded: None) -> None:
    client = APIClient()

    deg = client.get(f"/api/v1/sessions/{race_id(4)}/degradation", {"cars": "81"}).json()
    loss = client.get(f"/api/v1/sessions/{race_id(4)}/pit-loss").json()

    medium = next(c for c in deg["compounds"] if c["compound"] == "MEDIUM")
    assert 0.05 < medium["slope_s_per_lap"] < 0.2
    assert medium["low_confidence"] is False
    assert {s["car_number"] for s in deg["stints"]} == {81}
    assert deg["stints"][0]["points"]
    assert deg["fuel"]["gain_per_lap_s"] == pytest.approx(0.0579, abs=1e-3)
    assert 20 < loss["green_s"] < 26
    assert loss["neutralised"][0]["status"] == "SC"


def test_compare_two_drivers(seeded: None) -> None:
    body = APIClient().get(f"/api/v1/sessions/{race_id(14)}/compare", {"a": 4, "b": 81}).json()

    assert body["car_a"] == 4
    last = body["laps"][-1]
    assert last["lap"] == 70
    assert last["gap_s"] > 0  # Norris (4) won ahead of Piastri (81)


def test_undercut_simulation(seeded: None) -> None:
    payload = {
        "attacker": 81,
        "defender": 4,
        "stop_lap": 20,
        "attacker_compound": "HARD",
        "defender_compound": "HARD",
    }

    response = APIClient().post(
        f"/api/v1/sessions/{race_id(14)}/simulate/undercut", payload, format="json"
    )

    assert response.status_code == 200
    body = response.json()
    assert 0.0 <= body["p_attacker_ahead"] <= 1.0
    assert body["lap_gaps"][0]["lap"] == 20
    assert body["net_gain_s"] == pytest.approx(body["gap_before_s"] - body["gap_after_s"])


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"stop_lap": 69}, "stop_lap must be between"),
        ({"defender": 81}, "different cars"),
        ({"attacker_compound": "WET"}, "no degradation model"),
    ],
)
def test_undercut_rejects_impossible_requests(
    seeded: None, override: dict[str, object], message: str
) -> None:
    payload = {
        "attacker": 81,
        "defender": 4,
        "stop_lap": 20,
        "attacker_compound": "HARD",
        "defender_compound": "HARD",
    }

    response = APIClient().post(
        f"/api/v1/sessions/{race_id(14)}/simulate/undercut", {**payload, **override}, format="json"
    )

    assert response.status_code == 400
    assert message in str(response.json()["invalid_params"])


def test_pit_exit_simulation_with_scenario(seeded: None) -> None:
    client = APIClient()
    url = f"/api/v1/sessions/{race_id(14)}/simulate/pit-exit"

    blind = client.post(url, {"car": 4, "pit_lap": 20}, format="json").json()
    scenario = client.post(
        url, {"car": 4, "pit_lap": 20, "rival_stops": [{"car": 81, "lap": 20}]}, format="json"
    ).json()
    sc = client.post(url, {"car": 4, "pit_lap": 20, "neutralisation": "SC"}, format="json").json()

    assert sum(blind["distribution"]) == pytest.approx(1.0)
    assert blind["interval"][0] <= blind["most_likely_position"] <= blind["interval"][1]
    assert scenario["most_likely_position"] <= blind["most_likely_position"]
    assert sc["pit_loss_s"] < blind["pit_loss_s"]


def test_pit_exit_rejects_bad_laps(seeded: None) -> None:
    url = f"/api/v1/sessions/{race_id(14)}/simulate/pit-exit"

    assert APIClient().post(url, {"car": 4, "pit_lap": 70}, format="json").status_code == 400


def test_strategy_endpoints_need_timing_data(seeded: None) -> None:
    quali = Session.objects.get(event__round=14, kind=SessionKind.QUALIFYING)

    response = APIClient().get(f"/api/v1/sessions/{quali.pk}/pit-loss")

    assert response.status_code == 400


def test_context_is_cached_per_ingestion(seeded: None) -> None:
    session = Session.objects.get(event__round=16, kind=SessionKind.RACE)

    first = services.race_context(session)
    second = services.race_context(session)

    assert first is second or first.race == second.race
    assert services.context_version(session).startswith("0.1.0-")


def test_model_card(db: None) -> None:
    body = APIClient().get("/api/v1/model").json()

    names = {(a["group"], a["name"]) for a in body["assumptions"]}
    assert ("Fuel", "seconds_per_kg") in names
    assert ("Pit exit", "gap_noise_s_per_lap") in names
    gap_noise = next(a for a in body["assumptions"] if a["name"] == "gap_noise_s_per_lap")
    assert gap_noise["value"] == "1.5"
    assert "calibrated" in gap_noise["description"]
    assert body["backtest"]["held-out"]["scenario"]["overall"]["n"] == 155


def test_replay_lists_line_times_and_tyres_per_lap(seeded: None) -> None:
    response = APIClient().get(f"/api/v1/sessions/{race_id(14)}/replay")

    assert response.status_code == 200
    body = response.json()
    assert body["total_laps"] == 70
    norris = next(car for car in body["cars"] if car["car_number"] == 4)
    assert len(norris["line_times_s"]) == 70
    assert norris["line_times_s"][0] < norris["line_times_s"][1]
    assert norris["pit_in_laps"] == [31]
    assert norris["compounds"][0] == "MEDIUM"
    assert norris["compounds"][40] == "HARD"
    assert response["ETag"]
