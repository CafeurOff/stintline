"""Shape of ``/api/v1/forecasts``."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.forecast.models import SessionForecast


class ForecastHourSerializer(serializers.Serializer[Any]):
    at = serializers.DateTimeField()
    air_c = serializers.FloatField(allow_null=True)
    rain_probability_pct = serializers.FloatField(allow_null=True)
    precipitation_mm = serializers.FloatField(allow_null=True)
    wind_ms = serializers.FloatField(allow_null=True)
    weather_code = serializers.IntegerField(allow_null=True)


class SessionForecastSerializer(serializers.ModelSerializer[SessionForecast]):
    session_id = serializers.IntegerField(read_only=True)
    event_id = serializers.IntegerField(source="session.event_id", read_only=True)
    kind = serializers.CharField(source="session.kind", read_only=True)
    hours = ForecastHourSerializer(many=True, read_only=True)

    class Meta:
        model = SessionForecast
        fields = [
            "session_id",
            "event_id",
            "kind",
            "fetched_at",
            "window_start",
            "window_end",
            "air_c",
            "air_min_c",
            "air_max_c",
            "rain_probability_pct",
            "precipitation_mm",
            "wind_ms",
            "weather_code",
            "hours",
        ]


class ForecastQuerySerializer(serializers.Serializer[Any]):
    event = serializers.IntegerField(required=False, min_value=1)
