from collections.abc import Iterator
from io import StringIO

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.db import transaction
from pytest_django import DjangoDbBlocker

# Importing the demo races takes about 2 s, and over a hundred tests read them. They are
# imported once per test process inside a transaction that stays open until the end of the
# session; each test then runs in a savepoint that is rolled back, as with any `db` test.
# Tests that ask for this data run last (see `pytest_collection_modifyitems`), so tests
# without it still start from an empty database.
SEEDED = "seeded"
ANALYSED = "analysed"


@pytest.fixture(autouse=True)
def _clear_cache() -> Iterator[None]:
    cache.clear()
    yield
    cache.clear()


def _layer(blocker: DjangoDbBlocker, *command: str) -> Iterator[None]:
    """Run a management command inside a transaction kept open for the whole session."""
    atomic = transaction.atomic()
    with blocker.unblock():
        atomic.__enter__()
        call_command(*command, stdout=StringIO())
    try:
        yield
    finally:
        with blocker.unblock():
            transaction.set_rollback(True)
            atomic.__exit__(None, None, None)


@pytest.fixture(scope="session")
def _seeded_once(django_db_setup: None, django_db_blocker: DjangoDbBlocker) -> Iterator[None]:
    yield from _layer(django_db_blocker, "seed_demo")


@pytest.fixture(scope="session")
def _analysed_once(_seeded_once: None, django_db_blocker: DjangoDbBlocker) -> Iterator[None]:
    yield from _layer(django_db_blocker, "build_analysis", "--all")


@pytest.fixture
def seeded(_seeded_once: None, db: None) -> None:
    """2025 calendar plus the Bahrain (R4), Hungary (R14) and Italy (R16) races."""


@pytest.fixture
def analysed(_analysed_once: None, seeded: None) -> None:
    """The demo races with their analysis figures built."""


@pytest.hookimpl(trylast=True)
def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """Empty-database tests first, then seeded ones, then those that also need the analysis."""

    def layer(item: pytest.Item) -> int:
        names = getattr(item, "fixturenames", ())
        return 2 if ANALYSED in names else 1 if SEEDED in names else 0

    items.sort(key=layer)
