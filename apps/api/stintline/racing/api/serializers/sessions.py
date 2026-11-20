"""One session: entries, stints, pit stops, the circuit outline, team radio and sectors."""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.racing.api.serializers.calendar import EventSummarySerializer
from stintline.racing.api.serializers.common import (
    DriverSerializer,
    MediaSerializer,
    TeamSerializer,
)
from stintline.racing.media import media_for
from stintline.racing.models import (
    PitStop,
    Session,
    SessionEntry,
    Stint,
    TeamRadio,
    TrackStatus,
)


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
            "race_time_s",
            "fastest_lap_rank",
            "fastest_lap_s",
            "q1_s",
            "q2_s",
            "q3_s",
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


class TeamRadioSerializer(serializers.ModelSerializer[TeamRadio]):
    class Meta:
        model = TeamRadio
        fields = ["car_number", "recorded_at", "url"]


class SectorsSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    best_lap_s = serializers.FloatField(allow_null=True)
    best_sectors_s = serializers.ListField(
        child=serializers.FloatField(allow_null=True), min_length=3, max_length=3
    )
    ideal_lap_s = serializers.FloatField(
        allow_null=True, help_text="Sum of the three best sectors, from any laps"
    )
    top_speed_kph = serializers.IntegerField(allow_null=True, help_text="Speed trap maximum")
