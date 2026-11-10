"""Shape of the live snapshot (``/api/v1/live`` and the ``/ws/live`` messages)."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers


class LiveSessionSerializer(serializers.Serializer[Any]):
    key = serializers.IntegerField(allow_null=True)
    meeting = serializers.CharField()
    name = serializers.CharField()
    type = serializers.CharField()
    circuit_key = serializers.IntegerField(allow_null=True)
    circuit = serializers.CharField()
    country = serializers.CharField()
    status = serializers.CharField(
        help_text="Inactive, Started, Aborted, Finished, Finalised, Ends"
    )
    starts_at = serializers.DateTimeField(allow_null=True)


class PitNowSerializer(serializers.Serializer[Any]):
    position = serializers.IntegerField()
    ahead = serializers.IntegerField(allow_null=True)
    behind = serializers.IntegerField(allow_null=True)
    margin_ahead_s = serializers.FloatField(allow_null=True)
    margin_behind_s = serializers.FloatField(allow_null=True)


class LiveCarSerializer(serializers.Serializer[Any]):
    number = serializers.IntegerField()
    code = serializers.CharField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    team = serializers.CharField()
    colour = serializers.CharField()
    position = serializers.IntegerField(allow_null=True)
    gap_s = serializers.FloatField(allow_null=True)
    laps_behind = serializers.IntegerField()
    interval_s = serializers.FloatField(allow_null=True)
    laps = serializers.IntegerField()
    in_pit = serializers.BooleanField()
    pit_out = serializers.BooleanField()
    retired = serializers.BooleanField()
    stopped = serializers.BooleanField()
    pit_stops = serializers.IntegerField()
    last_lap_s = serializers.FloatField(allow_null=True)
    best_lap_s = serializers.FloatField(allow_null=True)
    compound = serializers.CharField(allow_null=True)
    tyre_age = serializers.IntegerField(allow_null=True)
    tyre_new = serializers.BooleanField(allow_null=True)
    lap_progress = serializers.FloatField(help_text="Share of the current lap completed")
    pit_now = PitNowSerializer(allow_null=True, help_text="Where the car rejoins if it pits now")


class RaceControlSerializer(serializers.Serializer[Any]):
    at = serializers.DateTimeField(allow_null=True)
    category = serializers.CharField()
    flag = serializers.CharField()
    message = serializers.CharField()
    lap = serializers.IntegerField(allow_null=True)


class RadioSerializer(serializers.Serializer[Any]):
    at = serializers.DateTimeField(allow_null=True)
    number = serializers.IntegerField()
    url = serializers.URLField(help_text="Official recording, played from its source")


class WeatherSerializer(serializers.Serializer[Any]):
    air_c = serializers.FloatField(allow_null=True)
    track_c = serializers.FloatField(allow_null=True)
    humidity_pct = serializers.FloatField(allow_null=True)
    rain = serializers.BooleanField()
    wind_ms = serializers.FloatField(allow_null=True)


class LiveSnapshotSerializer(serializers.Serializer[Any]):
    session = LiveSessionSerializer()
    lap = serializers.IntegerField(allow_null=True)
    total_laps = serializers.IntegerField(allow_null=True)
    track_status = serializers.CharField(
        help_text="clear, yellow, safety_car, virtual_safety_car, vsc_ending, red"
    )
    remaining = serializers.CharField(allow_null=True)
    cars = LiveCarSerializer(many=True)
    race_control = RaceControlSerializer(many=True)
    team_radio = RadioSerializer(many=True)
    weather = WeatherSerializer(allow_null=True)
    reference_session_id = serializers.IntegerField(
        allow_null=True, help_text="Stored race at this circuit, for the circuit outline"
    )
    pit_loss_s = serializers.FloatField(allow_null=True)
    pit_loss_sigma_s = serializers.FloatField(allow_null=True)
    updated_at = serializers.FloatField(help_text="Unix time of this snapshot")


class NextSessionSerializer(serializers.Serializer[Any]):
    event_id = serializers.IntegerField()
    event_name = serializers.CharField()
    kind = serializers.CharField()
    starts_at = serializers.DateTimeField()


class LiveStatusSerializer(serializers.Serializer[Any]):
    state = serializers.ChoiceField(
        choices=["offline", "waiting", "live", "finished"],
        help_text="offline: the live process is not running or has nothing recent",
    )
    snapshot = LiveSnapshotSerializer(allow_null=True)
    next_session = NextSessionSerializer(allow_null=True)
