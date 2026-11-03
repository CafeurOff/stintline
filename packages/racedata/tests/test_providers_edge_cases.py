"""Malformed and missing upstream data, through in-memory transports."""

from __future__ import annotations

import json
from typing import Any

import httpx
import pytest

from racedata import InvalidPayloadError
from racedata.http import HttpClient
from racedata.models import Compound, SessionKind
from racedata.providers.jolpica import JolpicaSource
from racedata.providers.openf1 import OpenF1Source


def client_returning(routes: dict[str, Any]) -> HttpClient:
    def handler(request: httpx.Request) -> httpx.Response:
        key = request.url.path.rsplit("/v1/", 1)[-1].removeprefix("/ergast/f1/")
        offset = request.url.params.get("offset")
        body = routes[f"{key}?offset={offset}"] if offset else routes[key]
        return httpx.Response(200, content=json.dumps(body).encode())

    return HttpClient("t", "https://api.test/v1", transport=httpx.MockTransport(handler))


def jolpica_client(routes: dict[str, Any]) -> HttpClient:
    def handler(request: httpx.Request) -> httpx.Response:
        key = request.url.path.removeprefix("/ergast/f1/")
        offset = request.url.params.get("offset")
        body = routes[f"{key}?offset={offset}"] if offset else routes[key]
        return httpx.Response(200, content=json.dumps(body).encode())

    return HttpClient("t", "https://api.test/ergast/f1", transport=httpx.MockTransport(handler))


def test_openf1_rejects_non_list_payloads() -> None:
    source = OpenF1Source(client_returning({"laps": {"detail": "error"}}))

    with pytest.raises(InvalidPayloadError, match="expected a list"):
        source.laps(1)


def test_openf1_treats_no_results_404_as_an_empty_list() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, content=b'{"detail":"No results found."}')

    client = HttpClient("t", "https://api.test/v1", transport=httpx.MockTransport(handler))

    assert OpenF1Source(client).pit(9969) == []


def test_openf1_skips_malformed_rows_but_keeps_valid_ones() -> None:
    rows = [
        {"driver_number": 1, "lap_number": 1, "lap_duration": None, "date_start": None},
        {"driver_number": "x", "lap_number": 2},
        {"lap_number": 3},
        {"driver_number": 1, "lap_number": 4, "lap_duration": 90.1, "date_start": "bad"},
    ]
    laps = OpenF1Source(client_returning({"laps": rows})).laps(1)

    assert [lap.lap_number for lap in laps] == [1]
    assert laps[0].lap_time_s is None
    assert laps[0].started_at is None


def test_openf1_unknown_compounds_and_missing_ages() -> None:
    rows = [
        {"driver_number": 1, "stint_number": 1, "compound": None},
        {"driver_number": 1, "stint_number": 2, "compound": "TEST_UNKNOWN", "lap_start": "3"},
        {"driver_number": 1, "stint_number": 3, "compound": "soft", "tyre_age_at_start": 4},
    ]
    stints = OpenF1Source(client_returning({"stints": rows})).stints(1)

    assert [s.compound for s in stints] == [Compound.UNKNOWN, Compound.UNKNOWN, Compound.SOFT]
    assert stints[0].tyre_age_at_start is None
    assert stints[1].lap_start == 3


def test_openf1_sessions_filter_kind_and_cancelled() -> None:
    base = {"meeting_key": 1, "date_start": "2025-01-01T10:00:00+00:00", "year": 2025}
    rows = [
        {**base, "session_key": 1, "session_name": "Race"},
        {**base, "session_key": 2, "session_name": "Race", "is_cancelled": True},
        {**base, "session_key": 3, "session_name": "Day 1"},
    ]
    sessions = OpenF1Source(client_returning({"sessions": rows})).sessions(2025, SessionKind.RACE)

    assert [s.session_key for s in sessions] == [1]
    assert sessions[0].ends_at is None


def test_openf1_pit_falls_back_to_pit_duration_and_drivers_without_colour() -> None:
    routes = {
        "pit": [
            {
                "driver_number": 4,
                "lap_number": 20,
                "date": "2025-01-01T10:00:00Z",
                "pit_duration": "22.4",
            }
        ],
        "drivers": [{"driver_number": 4, "team_colour": None}],
    }
    source = OpenF1Source(client_returning(routes))

    assert source.pit(1)[0].pit_lane_duration_s == pytest.approx(22.4)
    assert source.pit(1)[0].stationary_duration_s is None
    assert source.drivers(1)[0].team_colour is None
    assert source.drivers(1)[0].media_id is None


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        (
            "https://x/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png",
            "lannor01",
        ),
        ("https://x/elsewhere.png", None),
        (None, None),
    ],
)
def test_media_id_from_headshot(url: str | None, expected: str | None) -> None:
    from racedata.providers.openf1 import media_id_from_headshot

    assert media_id_from_headshot(url) == expected


def _mr(table: dict[str, Any], total: int) -> dict[str, Any]:
    return {"MRData": {"total": str(total), "RaceTable": table}}


def test_jolpica_follows_pagination_and_merges_rows() -> None:
    page1 = _mr(
        {
            "Races": [
                {
                    "round": "1",
                    "PitStops": [{"driverId": "a", "stop": "1", "lap": "10", "duration": "1:02.5"}],
                }
            ]
        },
        150,
    )
    page2 = _mr(
        {
            "Races": [
                {
                    "round": "1",
                    "PitStops": [{"driverId": "b", "stop": "1", "lap": "11", "duration": ""}],
                }
            ]
        },
        150,
    )
    source = JolpicaSource(
        jolpica_client({"2025/1/pitstops": page1, "2025/1/pitstops?offset=100": page2})
    )

    stops = source.pit_stops(2025, 1)

    assert [s.driver_id for s in stops] == ["a", "b"]
    assert stops[0].duration_s == pytest.approx(62.5)
    assert stops[1].duration_s is None


def test_jolpica_unexpected_shape_raises() -> None:
    source = JolpicaSource(jolpica_client({"2025/races": {"oops": True}}))

    with pytest.raises(InvalidPayloadError, match="unexpected payload"):
        source.season_events(2025)


def test_jolpica_malformed_rows_raise() -> None:
    bad_event = _mr({"Races": [{"round": "1"}]}, 1)
    bad_result = _mr({"Races": [{"round": "1", "Results": [{"number": "4"}]}]}, 1)
    bad_stop = _mr({"Races": [{"round": "1", "PitStops": [{"stop": "1"}]}]}, 1)
    source = JolpicaSource(
        jolpica_client(
            {"2025/races": bad_event, "2025/1/results": bad_result, "2025/1/pitstops": bad_stop}
        )
    )

    with pytest.raises(InvalidPayloadError):
        source.season_events(2025)
    with pytest.raises(InvalidPayloadError):
        source.results(2025, 1, SessionKind.RACE)
    with pytest.raises(InvalidPayloadError):
        source.pit_stops(2025, 1)


def test_jolpica_sprint_results_and_empty_tables() -> None:
    row = {
        "number": "81",
        "grid": "0",
        "position": "1",
        "positionText": "1",
        "points": "8",
        "laps": "19",
        "status": "Finished",
        "Driver": {"driverId": "piastri", "givenName": "Oscar", "familyName": "Piastri"},
        "Constructor": {"constructorId": "mclaren", "name": "McLaren"},
    }
    routes = {
        "2025/6/sprint": _mr({"Races": [{"round": "6", "SprintResults": [row]}]}, 1),
        "2025/7/pitstops": _mr({"Races": []}, 0),
    }
    source = JolpicaSource(jolpica_client(routes))

    sprint = source.results(2025, 6, SessionKind.SPRINT)
    assert sprint[0].grid is None  # pit-lane start
    assert sprint[0].code is None
    assert source.pit_stops(2025, 7) == []


def test_jolpica_skips_malformed_history_rows() -> None:
    standings = {
        "MRData": {
            "total": "2",
            "StandingsTable": {
                "StandingsLists": [
                    {
                        "season": "1960",
                        "round": "10",
                        "DriverStandings": [
                            {
                                "position": "1",
                                "points": "43",
                                "wins": "5",
                                "Driver": {"driverId": "brabham"},
                            },
                            {"position": "2", "points": "34"},
                        ],
                    }
                ]
            },
        }
    }
    drivers = {
        "MRData": {
            "total": "2",
            "DriverTable": {
                "Drivers": [
                    {
                        "driverId": "a",
                        "givenName": "A",
                        "familyName": "B",
                        "dateOfBirth": "1930-01-01",
                    },
                    {"driverId": "broken"},
                ]
            },
        }
    }
    quali = {
        "MRData": {
            "total": "1",
            "RaceTable": {
                "Races": [{"round": "1", "QualifyingResults": [{"number": "x", "Driver": {}}]}]
            },
        }
    }
    source = JolpicaSource(
        jolpica_client(
            {"1960/driverstandings": standings, "drivers": drivers, "1960/qualifying": quali}
        )
    )

    table = source.standings(1960, None, constructors=False)

    assert [r.competitor_id for r in table] == ["brabham"]
    assert [d.driver_id for d in source.drivers()] == ["a"]
    assert source.season_qualifying(1960) == {1: []}


def test_jolpica_list_with_unexpected_shape_raises() -> None:
    source = JolpicaSource(jolpica_client({"constructors": {"MRData": {"total": "1"}}}))

    with pytest.raises(InvalidPayloadError):
        source.constructors()


def test_openf1_team_radio_requires_an_https_recording() -> None:
    rows = [
        {
            "driver_number": 4,
            "date": "2025-08-03T13:17:53+00:00",
            "recording_url": "https://x/a.mp3",
        },
        {"driver_number": 4, "date": "2025-08-03T13:18:53+00:00", "recording_url": "ftp://x/b.mp3"},
    ]
    radio = OpenF1Source(client_returning({"team_radio": rows})).team_radio(1)

    assert [r.url for r in radio] == ["https://x/a.mp3"]
