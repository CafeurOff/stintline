"""Open-Meteo adapter: hourly weather forecasts at a circuit (ADR 0020).

One call per Grand Prix weekend: ``/forecast`` with the circuit coordinates, the
weekend's dates and the few hourly variables we show. Times are requested in GMT so
they are UTC at the boundary. Forecasts reach 16 days ahead; data is CC BY 4.0 and must
be credited to Open-Meteo wherever it is shown.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Any

from racedata.errors import InvalidPayloadError
from racedata.http import HttpClient
from racedata.models import HourlyForecast

PROVIDER = "openmeteo"
HORIZON_DAYS = 16
"""Open-Meteo's forecast range: later dates are rejected."""
COORDINATE_DECIMALS = 2
"""About 1 km: plenty for weather, and keeps request (and fixture) keys stable."""
HOURLY = (
    "temperature_2m",
    "precipitation_probability",
    "precipitation",
    "wind_speed_10m",
    "weather_code",
)


def _number(values: list[Any], index: int) -> float | None:
    value = values[index] if index < len(values) else None
    return float(value) if isinstance(value, int | float) else None


class OpenMeteoSource:
    def __init__(self, client: HttpClient) -> None:
        self._client = client

    def hourly(
        self, latitude: float, longitude: float, start: date, end: date
    ) -> list[HourlyForecast]:
        """Hourly forecast from ``start`` to ``end`` (inclusive dates, UTC)."""
        data = self._client.get_json(
            "forecast",
            {
                "latitude": f"{latitude:.{COORDINATE_DECIMALS}f}",
                "longitude": f"{longitude:.{COORDINATE_DECIMALS}f}",
                "hourly": ",".join(HOURLY),
                "timezone": "GMT",
                "wind_speed_unit": "ms",
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            },
        )
        hourly = data.get("hourly") if isinstance(data, dict) else None
        if not isinstance(hourly, dict) or not isinstance(hourly.get("time"), list):
            raise InvalidPayloadError(PROVIDER, "forecast without an 'hourly.time' list")
        columns: dict[str, list[Any]] = {}
        for name in HOURLY:
            column = hourly.get(name)
            if not isinstance(column, list):
                raise InvalidPayloadError(PROVIDER, f"forecast without hourly {name!r}")
            columns[name] = column
        out: list[HourlyForecast] = []
        for index, stamp in enumerate(hourly["time"]):
            try:
                at = datetime.fromisoformat(str(stamp)).replace(tzinfo=UTC)
            except ValueError as exc:
                raise InvalidPayloadError(PROVIDER, f"bad forecast time {stamp!r}") from exc
            code = _number(columns["weather_code"], index)
            out.append(
                HourlyForecast(
                    at=at,
                    air_c=_number(columns["temperature_2m"], index),
                    rain_probability_pct=_number(columns["precipitation_probability"], index),
                    precipitation_mm=_number(columns["precipitation"], index),
                    wind_ms=_number(columns["wind_speed_10m"], index),
                    weather_code=None if code is None else int(code),
                )
            )
        return out
