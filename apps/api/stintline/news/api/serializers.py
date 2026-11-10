from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.news.models import Headline
from stintline.news.services import SOURCE_NAMES
from stintline.racing.api.serializers import (
    DriverSerializer,
    EventSummarySerializer,
    TeamSerializer,
)
from stintline.racing.models import SessionEntry


class HeadlineSerializer(serializers.ModelSerializer[Headline]):
    source_name = serializers.SerializerMethodField()

    class Meta:
        model = Headline
        fields = ["source", "source_name", "language", "title", "url", "published_at"]

    def get_source_name(self, headline: Headline) -> str:
        return SOURCE_NAMES.get(headline.source, headline.source)


class HeadlineQuerySerializer(serializers.Serializer[Any]):
    lang = serializers.ChoiceField(choices=["en", "fr"], required=False)
    limit = serializers.IntegerField(min_value=1, max_value=60, default=30)


class ReportQuerySerializer(serializers.Serializer[Any]):
    limit = serializers.IntegerField(min_value=1, max_value=30, default=12)


class ReportEntrySerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    team = TeamSerializer(read_only=True)

    class Meta:
        model = SessionEntry
        fields = [
            "car_number",
            "driver",
            "team",
            "team_colour",
            "grid_position",
            "finish_position",
            "status",
            "fastest_lap_s",
            "laps_completed",
        ]


class PlacedSerializer(serializers.Serializer[Any]):
    entry = ReportEntrySerializer()
    gap_s = serializers.FloatField(allow_null=True, help_text="Behind the winner, same lap")
    laps_down = serializers.IntegerField()


class NeutralisationCountSerializer(serializers.Serializer[Any]):
    safety_cars = serializers.IntegerField()
    virtual_safety_cars = serializers.IntegerField()
    red_flags = serializers.IntegerField()


class WinnerStrategySerializer(serializers.Serializer[Any]):
    stops = serializers.IntegerField()
    compounds = serializers.ListField(child=serializers.CharField())


class ChampionshipSerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField()
    leader = DriverSerializer()
    points = serializers.FloatField()
    second = DriverSerializer(allow_null=True)
    lead = serializers.FloatField(allow_null=True)
    leader_changed = serializers.BooleanField()


class StartMoveSerializer(serializers.Serializer[Any]):
    entry = ReportEntrySerializer()
    grid = serializers.IntegerField()
    position = serializers.IntegerField(help_text="Position at the end of lap 1")


class LapsLedSerializer(serializers.Serializer[Any]):
    entry = ReportEntrySerializer()
    laps = serializers.IntegerField()


class DecisiveSerializer(serializers.Serializer[Any]):
    lap = serializers.IntegerField(help_text="First lap of the winner's last spell in the lead")
    how = serializers.ChoiceField(
        choices=["lights_to_flag", "undercut", "pit_cycle", "rival_stop", "on_track"]
    )
    rival = ReportEntrySerializer(allow_null=True)


class StorySerializer(serializers.Serializer[Any]):
    start_gains = StartMoveSerializer(many=True)
    start_losses = StartMoveSerializer(many=True)
    leaders = LapsLedSerializer(many=True)
    lead_changes = serializers.IntegerField()
    decisive = DecisiveSerializer(allow_null=True)


STOP_TIME_KINDS = [("stationary", "stationary"), ("lane", "lane")]


class FastestStopSerializer(serializers.Serializer[Any]):
    entry = ReportEntrySerializer()
    lap = serializers.IntegerField()
    duration_s = serializers.FloatField()
    measure = serializers.ChoiceField(
        choices=STOP_TIME_KINDS, help_text="Stationary time, or time in the pit lane"
    )


class PitSummarySerializer(serializers.Serializer[Any]):
    total = serializers.IntegerField()
    fastest = FastestStopSerializer(allow_null=True)


class WeatherSpanSerializer(serializers.Serializer[Any]):
    air_min = serializers.FloatField()
    air_max = serializers.FloatField()
    track_min = serializers.FloatField()
    track_max = serializers.FloatField()


class TeamPointsSerializer(serializers.Serializer[Any]):
    team = TeamSerializer()
    points = serializers.FloatField()
    colour = serializers.CharField()


class StandingChangeSerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    position = serializers.IntegerField()
    points = serializers.FloatField()
    change = serializers.IntegerField(
        allow_null=True, help_text="Places gained (+) or lost (-) since the previous round"
    )


class ResultLineSerializer(serializers.Serializer[Any]):
    entry = ReportEntrySerializer()
    position = serializers.IntegerField(allow_null=True)
    classification = serializers.CharField()
    gap_s = serializers.FloatField(allow_null=True)
    laps_down = serializers.IntegerField()
    points = serializers.FloatField()


def _optional(serializer: type[serializers.Serializer[Any]], value: Any) -> Any:
    return None if value is None else serializer(value).data


class RaceReportSerializer(serializers.Serializer[Any]):
    """Facts of a race or sprint, turned into sentences by the web (EN/FR)."""

    session_id = serializers.IntegerField()
    kind = serializers.CharField()
    event = EventSummarySerializer()
    finished_at = serializers.DateTimeField()
    winner = ReportEntrySerializer()
    winner_wins = serializers.IntegerField(
        allow_null=True, help_text="Career Grand Prix wins including this one (races only)"
    )
    podium = PlacedSerializer(many=True)
    starters = serializers.IntegerField()
    classified = serializers.IntegerField()
    biggest_gain = ReportEntrySerializer(allow_null=True)
    fastest_lap = ReportEntrySerializer(allow_null=True)
    retirements = ReportEntrySerializer(many=True)
    neutralisations = serializers.SerializerMethodField()
    rain = serializers.BooleanField(allow_null=True, help_text="Rain recorded during the session")
    winner_strategy = serializers.SerializerMethodField()
    championship = serializers.SerializerMethodField()
    story = serializers.SerializerMethodField()
    pit_stops = serializers.SerializerMethodField()
    weather = serializers.SerializerMethodField()
    teams = TeamPointsSerializer(many=True)
    standings = StandingChangeSerializer(many=True)
    results = ResultLineSerializer(many=True)

    @extend_schema_field(StorySerializer(allow_null=True))
    def get_story(self, report: dict[str, Any]) -> Any:
        return _optional(StorySerializer, report["story"])

    @extend_schema_field(PitSummarySerializer(allow_null=True))
    def get_pit_stops(self, report: dict[str, Any]) -> Any:
        return _optional(PitSummarySerializer, report["pit_stops"])

    @extend_schema_field(WeatherSpanSerializer(allow_null=True))
    def get_weather(self, report: dict[str, Any]) -> Any:
        return _optional(WeatherSpanSerializer, report["weather"])

    @extend_schema_field(NeutralisationCountSerializer(allow_null=True))
    def get_neutralisations(self, report: dict[str, Any]) -> Any:
        value = report["neutralisations"]
        return None if value is None else NeutralisationCountSerializer(value).data

    @extend_schema_field(WinnerStrategySerializer(allow_null=True))
    def get_winner_strategy(self, report: dict[str, Any]) -> Any:
        value = report["winner_strategy"]
        return None if value is None else WinnerStrategySerializer(value).data

    @extend_schema_field(ChampionshipSerializer(allow_null=True))
    def get_championship(self, report: dict[str, Any]) -> Any:
        value = report["championship"]
        return None if value is None else ChampionshipSerializer(value).data
