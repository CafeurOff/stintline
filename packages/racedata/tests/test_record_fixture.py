import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from racedata.http import HttpClient
from racedata.tools import record_fixture


@pytest.fixture
def fake_upstream(monkeypatch: pytest.MonkeyPatch) -> list[Any]:
    payload: list[Any] = [
        {
            "driver_number": 1,
            "lap_number": 1,
            "segments_sector_1": [2048] * 10,
            "lap_duration": 90.0,
        }
    ]

    def factory(provider: str, base_url: str, **_: Any) -> HttpClient:
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
        return HttpClient(provider, base_url, transport=transport)

    monkeypatch.setattr(record_fixture, "HttpClient", factory)
    return payload


def test_record_writes_trimmed_fixture_and_metadata(
    tmp_path: Path, fake_upstream: list[Any]
) -> None:
    code = record_fixture.main(["openf1", "laps", "session_key=7", "--root", str(tmp_path)])

    assert code == 0
    file = tmp_path / "openf1" / "laps" / "session_key=7.json"
    assert json.loads(file.read_text()) == [
        {"driver_number": 1, "lap_duration": 90.0, "lap_number": 1}
    ]
    meta = json.loads(file.with_suffix(".meta.json").read_text())
    assert meta["dropped_fields"] == ["segments_sector_1", "segments_sector_2", "segments_sector_3"]
    assert meta["params"] == {"session_key": "7"}
    assert len(meta["sha256"]) == 64


def test_record_refuses_oversized_payloads(
    tmp_path: Path, fake_upstream: list[Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(record_fixture, "MAX_FIXTURE_BYTES", 10)

    with pytest.raises(SystemExit, match="Narrow the query"):
        record_fixture.record("openf1", "laps", {}, tmp_path)


def test_serialise_handles_objects_and_untrimmed_endpoints() -> None:
    assert record_fixture.serialise({"a": 1}).startswith("{")
    assert record_fixture.trim("openf1", "drivers", [{"headshot_url": "u"}])[1] == []
    data, dropped = record_fixture.trim("jolpica", "2025/races", {"MRData": {}})
    assert dropped == []
    assert data == {"MRData": {}}
