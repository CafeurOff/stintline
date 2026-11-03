from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.racing.media import media_for
from stintline.racing.models import (
    Circuit,
    Driver,
    Event,
    PitStop,
    Season,
    Session,
    SessionEntry,
    Stint,
    Team,
    TrackStatus,
)


class SeasonSerializer(serializers.ModelSerializer[Season]):
    events_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Season
        fields = ["year", "events_count"]


class CircuitSerializer(serializers.ModelSerializer[Circuit]):
    class Meta:
        model = Circuit
        fields = ["ref", "name", "locality", "country"]


class SessionSummarySerializer(serializers.ModelSerializer[Session]):
    has_data = serializers.BooleanField(read_only=True)

    class Meta:
        model = Session
        fields = ["id", "kind", "scheduled_start", "has_data"]


class EventSummarySerializer(serializers.ModelSerializer[Event]):
    season = serializers.IntegerField(source="season.year", read_only=True)
    circuit = CircuitSerializer(read_only=True)

    class Meta:
        model = Event
        fields = ["id", "season", "round", "name", "race_date", "format", "circuit"]


class EventSerializer(EventSummarySerializer):
    sessions = SessionSummarySerializer(many=True, read_only=True)

    class Meta(EventSummarySerializer.Meta):
        fields = [*EventSummarySerializer.Meta.fields, "sessions"]


class DriverSerializer(serializers.ModelSerializer[Driver]):
    class Meta:
        model = Driver
        fields = ["ref", "code", "given_name", "family_name"]


class TeamSerializer(serializers.ModelSerializer[Team]):
    class Meta:
        model = Team
        fields = ["ref", "name"]


class MediaSerializer(serializers.Serializer[Any]):
    driver_image_url = serializers.URLField(allow_null=True)
    car_image_url = serializers.URLField(allow_null=True)


class EntrySerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    team = TeamSerializer(read_only=True)
    media = serializers.SerializerMethodField()

    class Meta:
        model = SessionEntry
        fields = [
            "car_number",
            "driver",
            "team",
            "team_display_name",
            "team_colour",
            "grid_position",
            "finish_position",
            "classification",
            "status",
            "points",
            "laps_completed",
            "media",
        ]

    @extend_schema_field(MediaSerializer(allow_null=True))
    def get_media(self, entry: SessionEntry) -> dict[str, Any] | None:
        media = media_for(entry.session.event.season.year, entry.team_display_name, entry.media_id)
        return None if media is None else MediaSerializer(media).data


class NeutralisationSerializer(serializers.ModelSerializer[TrackStatus]):
    class Meta:
        model = TrackStatus
        fields = ["status", "lap_start", "lap_end"]


class SessionDetailSerializer(serializers.ModelSerializer[Session]):
    event = EventSummarySerializer(read_only=True)
    entries = EntrySerializer(many=True, read_only=True)
    neutralisations = NeutralisationSerializer(source="track_statuses", many=True, read_only=True)
    total_laps = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = ["id", "kind", "starts_at", "event", "total_laps", "entries", "neutralisations"]

    def get_total_laps(self, session: Session) -> int | None:
        winners = [e.laps_completed for e in session.entries.all() if e.finish_position == 1]
        return winners[0] if winners else None


class StintSerializer(serializers.ModelSerializer[Stint]):
    class Meta:
        model = Stint
        fields = ["stint_number", "compound", "lap_start", "lap_end", "tyre_age_at_start"]


class PitStopSerializer(serializers.ModelSerializer[PitStop]):
    class Meta:
        model = PitStop
        fields = [
            "lap_number",
            "stop_number",
            "pit_lane_duration_s",
            "stationary_duration_s",
            "reported_duration_s",
        ]


class EntryStintsSerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    stints = StintSerializer(many=True, read_only=True)
    pit_stops = PitStopSerializer(many=True, read_only=True)

    class Meta:
        model = SessionEntry
        fields = [
            "car_number",
            "driver",
            "team_colour",
            "finish_position",
            "classification",
            "stints",
            "pit_stops",
        ]


class TrackSerializer(serializers.Serializer[Any]):
    """Circuit outline in screen coordinates, samples evenly spaced in time over one lap."""

    width = serializers.IntegerField()
    height = serializers.IntegerField()
    car_number = serializers.IntegerField(help_text="Car whose reference lap drew the outline")
    lap_number = serializers.IntegerField()
    lap_time_s = serializers.FloatField()
    points = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2)
    )
