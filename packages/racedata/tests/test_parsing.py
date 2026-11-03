from datetime import UTC, datetime, timedelta, timezone

import pytest

from racedata import InvalidPayloadError
from racedata.parsing import (
    optional_float,
    optional_int,
    parse_date,
    parse_datetime,
    parse_duration_s,
    parse_optional_datetime,
    parse_utc_date_time,
)


def test_parse_datetime_normalises_to_utc() -> None:
    parsed = parse_datetime("p", "2025-08-03T15:00:00+02:00")
    assert parsed == datetime(2025, 8, 3, 13, 0, tzinfo=UTC)
    assert parsed.tzinfo is UTC
    assert parse_datetime("p", "2025-08-03T13:00:00Z") == parsed


@pytest.mark.parametrize("value", [None, 12, "not a date", "2025-08-03T13:00:00"])
def test_parse_datetime_rejects_invalid_or_naive(value: object) -> None:
    with pytest.raises(InvalidPayloadError):
        parse_datetime("p", value)


def test_optional_helpers() -> None:
    assert parse_optional_datetime("p", None) is None
    assert parse_optional_datetime("p", "") is None
    assert parse_utc_date_time("p", "2025-04-13", None) is None
    assert parse_utc_date_time("p", "2025-04-13", "15:00:00Z") == datetime(
        2025, 4, 13, 15, tzinfo=UTC
    )
    assert optional_int("7") == 7
    assert optional_int("x") is None
    assert optional_int("") is None
    assert optional_float("1.5") == 1.5
    assert optional_float([]) is None
    assert optional_float(None) is None


def test_parse_date() -> None:
    assert parse_date("p", "2025-04-13").isoformat() == "2025-04-13"
    with pytest.raises(InvalidPayloadError):
        parse_date("p", "13/04/2025")


@pytest.mark.parametrize(
    ("text", "expected"),
    [("21.594", 21.594), ("1:02.345", 62.345), (None, None), ("", None), ("abc", None)],
)
def test_parse_duration_s(text: str | None, expected: float | None) -> None:
    assert parse_duration_s(text) == (pytest.approx(expected) if expected else expected)


def test_dto_rejects_naive_datetimes() -> None:
    from racedata.models import ScheduledSession, SessionKind

    with pytest.raises(ValueError, match="timezone-aware"):
        ScheduledSession(kind=SessionKind.RACE, starts_at=datetime(2025, 1, 1))  # noqa: DTZ001
    aware = datetime(2025, 1, 1, tzinfo=timezone(timedelta(hours=2)))
    assert ScheduledSession(kind=SessionKind.RACE, starts_at=aware).starts_at == aware
