"""Championship standings and their progression round by round."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.racing.api.serializers.common import DriverSerializer, TeamSerializer
from stintline.racing.hub import SeasonColours, season_colours
from stintline.racing.models import (
    Standing,
)


class StandingLineSerializer(serializers.ModelSerializer[Standing]):
    driver = DriverSerializer(read_only=True, allow_null=True)
    team = TeamSerializer(read_only=True, allow_null=True)
    colour = serializers.SerializerMethodField(
        help_text="Team colour of the driver or team that season (timed seasons only), hex RGB"
    )

    class Meta:
        model = Standing
        fields = ["position", "position_text", "points", "wins", "driver", "team", "colour"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._colours: dict[int, SeasonColours] = {}

    def get_colour(self, line: Standing) -> str | None:
        colours = self._colours.get(line.season_id)
        if colours is None:
            colours = self._colours[line.season_id] = season_colours(line.season_id)
        if line.driver_id is not None:
            return colours.drivers.get(line.driver_id)
        return colours.teams.get(line.team_id) if line.team_id is not None else None


class StandingsSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    round = serializers.IntegerField(allow_null=True)
    rounds = serializers.ListField(child=serializers.IntegerField())
    drivers = StandingLineSerializer(many=True)
    constructors = StandingLineSerializer(many=True)


class RoundQuerySerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField(required=False, min_value=1, max_value=40)


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
