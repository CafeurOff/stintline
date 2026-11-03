from collections.abc import Iterator
from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import call_command


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def seeded(db: None) -> None:
    """2025 calendar plus the Bahrain (R4), Hungary (R14) and Italy (R16) races."""
    call_command("seed_demo", stdout=StringIO())
