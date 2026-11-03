from __future__ import annotations

from collections.abc import Iterator

import pytest

from racedata.sources import Sources, build_fixture_sources
from racedata.testing import FakeClock


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock()


@pytest.fixture(scope="session")
def sources() -> Iterator[Sources]:
    built = build_fixture_sources()
    yield built
    built.close()
