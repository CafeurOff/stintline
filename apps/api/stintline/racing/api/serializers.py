from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.racing.media import media_for
from stintline.racing.models import (
    Circuit,
    Driver,
    DriverPortrait,
    Event,
    PitStop,
    Season,
    Session,
    SessionEntry,
    SessionKind,
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
        fields = ["ref", "name", "locality", "country", "latitude", "longitude", "wikipedia_url"]


def portrait_of(driver: Driver) -> DriverPortrait | None:
    """The driver's Wikipedia portrait, if any (select ``driver__portrait`` to avoid N+1)."""
    try:
        return driver.portrait
    except DriverPortrait.DoesNotExist:
        return None


class PortraitSerializer(serializers.ModelSerializer[DriverPortrait]):
    """Freely licensed image with the credit its licence requires (ADR 0009)."""

    class Meta:
        model = DriverPortrait
        fields = ["image_url", "artist", "license", "license_url", "file_page_url"]


class DriverSerializer(serializers.ModelSerializer[Driver]):
    portrait_url = serializers.SerializerMethodField(
        help_text="Wikipedia portrait (ADR 0009); official media take precedence when present"
    )

    class Meta:
        model = Driver
        fields = ["ref", "code", "given_name", "family_name", "portrait_url"]

    def get_portrait_url(self, driver: Driver) -> str | None:
        portrait = portrait_of(driver)
        return portrait.image_url if portrait else None


class TeamSerializer(serializers.ModelSerializer[Team]):
    class Meta:
        model = Team
        fields = ["ref", "name"]


class WinnerSerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    team = TeamSerializer(read_only=True)

    class Meta:
        model = SessionEntry
        fields = ["car_number", "driver", "team", "team_colour"]


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
    winner = serializers.SerializerMethodField(help_text="Race winner, once classified")

    class Meta(EventSummarySerializer.Meta):
        fields = [*EventSummarySerializer.Meta.fields, "sessions", "winner"]

    @extend_schema_field(WinnerSerializer(allow_null=True))
    def get_winner(self, event: Event) -> dict[str, Any] | None:
        """Needs ``selectors.season_events`` (sessions prefetched with ``winners``)."""
        for session in event.sessions.all():
            if session.kind == SessionKind.RACE:
                winners = getattr(session, "winners", [])
                return WinnerSerializer(winners[0]).data if winners else None
        return None


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
    portrait = serializers.SerializerMethodField()

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
            "portrait",
        ]

    @extend_schema_field(PortraitSerializer(allow_null=True))
    def get_portrait(self, driver: Driver) -> dict[str, Any] | None:
        portrait = portrait_of(driver)
        return PortraitSerializer(portrait).data if portrait else None


class LatestTeamSerializer(serializers.Serializer[Any]):
    ref = serializers.CharField()
    name = serializers.CharField()
    colour = serializers.CharField(allow_null=True)


class DriverListItemSerializer(DriverBioSerializer):
    team = serializers.SerializerMethodField(
        help_text="Team of the latest race (in the requested season, if any)"
    )

    class Meta(DriverBioSerializer.Meta):
        fields = [*DriverBioSerializer.Meta.fields, "team"]

    @extend_schema_field(LatestTeamSerializer(allow_null=True))
    def get_team(self, driver: Driver) -> dict[str, Any] | None:
        """Needs ``hub.with_latest_team`` annotations."""
        ref = getattr(driver, "team_ref", None)
        if ref is None:
            return None
        return {
            "ref": ref,
            "name": getattr(driver, "team_name", ""),
            "colour": getattr(driver, "team_colour", None),
        }


class CareerTotalsSerializer(serializers.Serializer[Any]):
    seasons = serializers.IntegerField()
    first_season = serializers.IntegerField(allow_null=True)
    last_season = serializers.IntegerField(allow_null=True)
    starts = serializers.IntegerField()
    wins = serializers.IntegerField()
    podiums = serializers.IntegerField()
    poles = serializers.IntegerField()
    fastest_laps = serializers.IntegerField(
        allow_null=True, help_text="Unknown (null) for careers starting before 2004"
    )
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
    event_id = serializers.IntegerField(source="session.event.id", read_only=True)
    has_data = serializers.SerializerMethodField(help_text="Lap timing stored for this session")
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
            "event_id",
            "has_data",
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

    def get_has_data(self, entry: SessionEntry) -> bool:
        """Timing exists from 2023 for races and sprints (``Session.ingested_at``)."""
        return entry.session.ingested_at is not None


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


class TeamListSerializer(serializers.ModelSerializer[Team]):
    colour = serializers.CharField(
        read_only=True, allow_null=True, help_text="Latest timing colour (2023+), hex RGB"
    )

    class Meta:
        model = Team
        fields = ["ref", "name", "nationality", "wikipedia_url", "colour"]


class TeamTotalsSerializer(serializers.Serializer[Any]):
    seasons = serializers.IntegerField()
    first_season = serializers.IntegerField(allow_null=True)
    last_season = serializers.IntegerField(allow_null=True)
    starts = serializers.IntegerField(help_text="Races with at least one car starting")
    wins = serializers.IntegerField()
    podiums = serializers.IntegerField()
    poles = serializers.IntegerField()
    points = serializers.FloatField()
    championships = serializers.IntegerField()


class TeamSeasonSerializer(serializers.Serializer[Any]):
    year = serializers.IntegerField()
    drivers = DriverSerializer(many=True)
    starts = serializers.IntegerField()
    wins = serializers.IntegerField()
    podiums = serializers.IntegerField()
    points = serializers.FloatField()
    championship_position = serializers.IntegerField(allow_null=True)


class TeamCareerSerializer(serializers.Serializer[Any]):
    team = TeamListSerializer()
    colour = serializers.CharField(allow_null=True)
    totals = TeamTotalsSerializer()
    seasons = TeamSeasonSerializer(many=True, help_text="Most recent first")


class LastRaceSerializer(serializers.Serializer[Any]):
    session_id = serializers.IntegerField()
    event = EventSummarySerializer()
    has_data = serializers.BooleanField(help_text="Lap timing stored: the circuit replay works")
    podium = EntrySerializer(many=True)


class HomeSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField(allow_null=True)
    next_event = EventSerializer(allow_null=True)
    last_race = LastRaceSerializer(allow_null=True)
    drivers = StandingLineSerializer(many=True)
    constructors = StandingLineSerializer(many=True)


class RoundSerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField()
    name = serializers.CharField()


class DriverProgressionSerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    colour = serializers.CharField(allow_null=True)
    points = serializers.ListField(child=serializers.FloatField(allow_null=True))
    positions = serializers.ListField(child=serializers.IntegerField(allow_null=True))


class TeamProgressionSerializer(serializers.Serializer[Any]):
    team = TeamSerializer()
    colour = serializers.CharField(allow_null=True)
    points = serializers.ListField(child=serializers.FloatField(allow_null=True))
    positions = serializers.ListField(child=serializers.IntegerField(allow_null=True))


class ProgressionSerializer(serializers.Serializer[Any]):
    """Championship after each stored round (every round from 2023, the final table before)."""

    season = serializers.IntegerField()
    rounds = RoundSerializer(many=True)
    drivers = DriverProgressionSerializer(many=True)
    constructors = TeamProgressionSerializer(many=True)


class TeamQuerySerializer(serializers.Serializer[Any]):
    search = serializers.CharField(required=False, max_length=64)
    season = serializers.IntegerField(required=False, min_value=1950, max_value=2100)
