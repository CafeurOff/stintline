from pathlib import Path

import httpx
import pytest

from racedata.cache import FileCache, NullCache, cache_key
from racedata.fixtures import FixtureTransport, MissingFixtureError, fixture_path


def test_cache_key_ignores_parameter_order() -> None:
    a = cache_key("p", "https://x/laps", {"a": "1", "b": "2"})
    b = cache_key("p", "https://x/laps", {"b": "2", "a": "1"})
    assert a == b
    assert a != cache_key("other", "https://x/laps", {"a": "1", "b": "2"})


def test_file_cache_round_trip_and_corruption(tmp_path: Path) -> None:
    cache = FileCache(tmp_path)
    assert cache.get("abcd") is None

    cache.set("abcd", {"laps": [1, 2]})
    assert cache.get("abcd") == {"laps": [1, 2]}

    (tmp_path / "ab" / "abcd.json").write_text("{broken", encoding="utf-8")
    assert cache.get("abcd") is None


def test_null_cache_stores_nothing() -> None:
    cache = NullCache()
    cache.set("k", 1)
    assert cache.get("k") is None


def test_fixture_path_is_deterministic_and_safe(tmp_path: Path) -> None:
    path = fixture_path(tmp_path, "openf1", "/laps", {"session_key": "1", "driver_number": "4"})
    assert path == tmp_path / "openf1" / "laps" / "driver_number=4__session_key=1.json"
    assert fixture_path(tmp_path, "jolpica", "2025/races", {}).name == "_.json"
    assert ".." not in str(
        fixture_path(tmp_path, "x", "../../etc", {"a": "../b"}).relative_to(tmp_path)
    )


def test_fixture_transport_serves_recordings_and_strips_base_path(tmp_path: Path) -> None:
    file = fixture_path(tmp_path, "openf1", "laps", {"session_key": "7"})
    file.parent.mkdir(parents=True)
    file.write_text("[1]", encoding="utf-8")
    client = httpx.Client(transport=FixtureTransport("openf1", "/v1", tmp_path))

    assert client.get("https://api.test/v1/laps", params={"session_key": 7}).json() == [1]


def test_fixture_transport_refuses_unknown_requests(tmp_path: Path) -> None:
    client = httpx.Client(transport=FixtureTransport("openf1", "/v1", tmp_path))

    with pytest.raises(MissingFixtureError, match="No fixture"):
        client.get("https://api.test/v1/laps", params={"session_key": 1})


def test_build_http_sources_wires_cache_and_base_urls(tmp_path: Path) -> None:
    from racedata.sources import build_http_sources

    sources = build_http_sources(
        openf1_base_url="https://mirror.test/v1/", jolpica_base_url=None, cache_dir=tmp_path
    )
    try:
        openf1, jolpica, wikipedia = sources.clients
        assert openf1.base_url == "https://mirror.test/v1"
        assert jolpica.base_url == "https://api.jolpi.ca/ergast/f1"
        assert wikipedia.base_url == "https://en.wikipedia.org/w"
    finally:
        sources.close()
