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
        fields = [
            "id",
            "kind",
            "starts_at",
            "ends_at",
            "event",
            "total_laps",
            "entries",
            "neutralisations",
        ]

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


class TeamRadioSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    recorded_at = serializers.DateTimeField()
    url = serializers.URLField(help_text="Official recording, played from its source")
    lap = serializers.IntegerField(
        allow_null=True, help_text="The car's lap when the message was recorded"
    )
    transcript = serializers.CharField(
        allow_null=True,
        allow_blank=True,
        help_text=(
            "What was said, transcribed by speech recognition (ADR 0029): null while not "
            "transcribed yet, empty when nothing intelligible was said"
        ),
    )
    transcript_confidence = serializers.FloatField(
        allow_null=True, help_text="Mean token probability of the transcript (0 to 1)"
    )


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


class TimelineLapSerializer(serializers.Serializer[Any]):
    lap = serializers.IntegerField()
    start_s = serializers.FloatField(help_text="Seconds from the start of the session")
    end_s = serializers.FloatField(
        allow_null=True, help_text="Back at the line; null when the car stopped mid-lap"
    )
    drive_start_s = serializers.FloatField(
        allow_null=True, help_text="When the car is on track (an out lap starts in the garage)"
    )
    drive_from = serializers.FloatField(help_text="Share of the lap behind the car then")
    time_s = serializers.FloatField(allow_null=True)
    sectors_s = serializers.ListField(
        child=serializers.FloatField(allow_null=True), min_length=3, max_length=3
    )
    compound = serializers.CharField(allow_null=True)
    tyre_age = serializers.IntegerField(allow_null=True)
    pit_out = serializers.BooleanField()
    pit_in = serializers.BooleanField()
    deleted = serializers.BooleanField(help_text="Lap time deleted by race control")


class TimelineCarSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    laps = TimelineLapSerializer(many=True)


class TimelineSegmentSerializer(serializers.Serializer[Any]):
    number = serializers.IntegerField(help_text="1, 2 or 3 (Q1-Q3 or SQ1-SQ3)")
    start_s = serializers.FloatField()
    end_s = serializers.FloatField(help_text="Chequered flag of the segment")
    eliminated = serializers.ListField(
        child=serializers.IntegerField(), help_text="Car numbers knocked out, best first"
    )


class TimelineFlagSerializer(serializers.Serializer[Any]):
    status = serializers.ChoiceField(choices=["SC", "VSC", "RED"])
    start_s = serializers.FloatField()
    end_s = serializers.FloatField(allow_null=True)


class TimelineMessageSerializer(serializers.Serializer[Any]):
    at_s = serializers.FloatField()
    category = serializers.CharField()
    flag = serializers.CharField(allow_blank=True)
    car_number = serializers.IntegerField(allow_null=True)
    message = serializers.CharField()


class TimelineWeatherSerializer(serializers.Serializer[Any]):
    at_s = serializers.FloatField()
    air_temperature_c = serializers.FloatField(allow_null=True)
    track_temperature_c = serializers.FloatField(allow_null=True)
    rainfall = serializers.BooleanField()
    wind_speed_ms = serializers.FloatField(allow_null=True)


class TimelineSerializer(serializers.Serializer[Any]):
    """Every lap of a session on the session clock, for practice and qualifying replays,
    with the flags, race control messages and weather on the same clock."""

    starts_at = serializers.DateTimeField(help_text="Origin of every ``*_s`` value")
    duration_s = serializers.FloatField()
    cars = TimelineCarSerializer(many=True)
    segments = TimelineSegmentSerializer(many=True)
    flags = TimelineFlagSerializer(many=True, help_text="Red flags, safety cars")
    race_control = TimelineMessageSerializer(many=True)
    weather = TimelineWeatherSerializer(many=True)
