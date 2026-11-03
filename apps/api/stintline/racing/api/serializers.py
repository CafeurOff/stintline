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
    Standing,
    Stint,
    Team,
    TeamRadio,
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


class DriverBioSerializer(serializers.ModelSerializer[Driver]):
    class Meta:
        model = Driver
        fields = [
            "ref",
            "code",
            "given_name",
            "family_name",
            "permanent_number",
            "date_of_birth",
            "nationality",
            "wikipedia_url",
        ]


class CareerTotalsSerializer(serializers.Serializer[Any]):
    seasons = serializers.IntegerField()
    first_season = serializers.IntegerField(allow_null=True)
    last_season = serializers.IntegerField(allow_null=True)
    starts = serializers.IntegerField()
    wins = serializers.IntegerField()
    podiums = serializers.IntegerField()
    poles = serializers.IntegerField()
    fastest_laps = serializers.IntegerField()
    points = serializers.FloatField()
    championships = serializers.IntegerField()
    best_finish = serializers.IntegerField(allow_null=True)


class SeasonLineSerializer(serializers.Serializer[Any]):
    year = serializers.IntegerField()
    teams = serializers.ListField(child=serializers.CharField())
    starts = serializers.IntegerField()
    wins = serializers.IntegerField()
    podiums = serializers.IntegerField()
    points = serializers.FloatField()
    championship_position = serializers.IntegerField(allow_null=True)


class DriverCareerSerializer(serializers.Serializer[Any]):
    driver = DriverBioSerializer()
    media = MediaSerializer(allow_null=True)
    totals = CareerTotalsSerializer()
    seasons = SeasonLineSerializer(many=True)


class DriverResultSerializer(serializers.ModelSerializer[SessionEntry]):
    session_id = serializers.IntegerField(source="session.id", read_only=True)
    kind = serializers.CharField(source="session.kind", read_only=True)
    season = serializers.IntegerField(source="session.event.season.year", read_only=True)
    round = serializers.IntegerField(source="session.event.round", read_only=True)
    event_name = serializers.CharField(source="session.event.name", read_only=True)
    race_date = serializers.DateField(source="session.event.race_date", read_only=True)
    team = TeamSerializer(read_only=True)

    class Meta:
        model = SessionEntry
        fields = [
            "session_id",
            "kind",
            "season",
            "round",
            "event_name",
            "race_date",
            "team",
            "car_number",
            "grid_position",
            "finish_position",
            "classification",
            "status",
            "points",
            "fastest_lap_rank",
        ]


class StandingLineSerializer(serializers.ModelSerializer[Standing]):
    driver = DriverSerializer(read_only=True, allow_null=True)
    team = TeamSerializer(read_only=True, allow_null=True)

    class Meta:
        model = Standing
        fields = ["position", "position_text", "points", "wins", "driver", "team"]


class StandingsSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    round = serializers.IntegerField(allow_null=True)
    rounds = serializers.ListField(child=serializers.IntegerField())
    drivers = StandingLineSerializer(many=True)
    constructors = StandingLineSerializer(many=True)


class TeamRadioSerializer(serializers.ModelSerializer[TeamRadio]):
    class Meta:
        model = TeamRadio
        fields = ["car_number", "recorded_at", "url"]


class DriverQuerySerializer(serializers.Serializer[Any]):
    search = serializers.CharField(required=False, max_length=64)
    season = serializers.IntegerField(required=False, min_value=1950, max_value=2100)


class RoundQuerySerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField(required=False, min_value=1, max_value=40)
