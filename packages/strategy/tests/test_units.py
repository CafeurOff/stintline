import pytest

from stintline_strategy import format_lap_time, parse_lap_time


@pytest.mark.parametrize(
    ("text", "expected"),
    [("1:20.832", 80.832), ("80.832", 80.832), (" 0:59.999 ", 59.999), ("2:00.000", 120.0)],
)
def test_parse_lap_time_accepts_display_and_seconds_formats(text: str, expected: float) -> None:
    assert parse_lap_time(text) == pytest.approx(expected, abs=1e-9)


@pytest.mark.parametrize("text", ["", "   ", "abc", "1:xx.000", "1:60.000", "-1:10.000", "-5"])
def test_parse_lap_time_rejects_malformed_input(text: str) -> None:
    with pytest.raises(ValueError, match="lap time"):
        parse_lap_time(text)


@pytest.mark.parametrize(
    ("seconds", "expected"),
    [(80.832, "1:20.832"), (59.9996, "1:00.000"), (0.0, "0:00.000"), (125.4, "2:05.400")],
)
def test_format_lap_time_rounds_to_milliseconds(seconds: float, expected: str) -> None:
    assert format_lap_time(seconds) == expected


def test_format_lap_time_rejects_negative_values() -> None:
    with pytest.raises(ValueError, match="negative"):
        format_lap_time(-1.0)


def test_parse_and_format_round_trip() -> None:
    assert format_lap_time(parse_lap_time("1:31.447")) == "1:31.447"
