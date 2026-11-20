"""Team lists, line-ups and careers."""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.racing.api.serializers.common import DriverSerializer, MediaSerializer
from stintline.racing.media import media_for
from stintline.racing.models import (
    SessionEntry,
    Team,
)


class LineupSerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    media = serializers.SerializerMethodField()

    class Meta:
        model = SessionEntry
        fields = ["car_number", "driver", "media"]

    @extend_schema_field(MediaSerializer(allow_null=True))
    def get_media(self, entry: SessionEntry) -> dict[str, Any] | None:
        media = media_for(entry.session.event.season.year, entry.team_display_name, entry.media_id)
        return None if media is None else MediaSerializer(media).data


class SeasonTeamSerializer(serializers.Serializer[Any]):
    lineup = LineupSerializer(many=True, help_text="Drivers of the season's latest race")
    position = serializers.IntegerField(allow_null=True)
    points = serializers.FloatField(allow_null=True)
    car_image_url = serializers.URLField(allow_null=True, help_text="Official render (ADR 0006)")


class TeamListSerializer(serializers.ModelSerializer[Team]):
    colour = serializers.CharField(
        read_only=True, allow_null=True, help_text="Latest timing colour (2023+), hex RGB"
    )
    season = serializers.SerializerMethodField(
        help_text="Line-up, car and championship place in the requested season"
    )

    class Meta:
        model = Team
        fields = ["ref", "name", "nationality", "wikipedia_url", "colour", "season"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._season = SeasonTeamSerializer()

    @extend_schema_field(SeasonTeamSerializer(allow_null=True))
    def get_season(self, team: Team) -> dict[str, Any] | None:
        card = self.context.get("season_teams", {}).get(team.pk)
        return None if card is None else self._season.to_representation(card)


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
    car_image_url = serializers.URLField(
        allow_null=True, help_text="Official render of the latest car (ADR 0006)"
    )
    totals = TeamTotalsSerializer()
    seasons = TeamSeasonSerializer(many=True, help_text="Most recent first")


class TeamQuerySerializer(serializers.Serializer[Any]):
    search = serializers.CharField(required=False, max_length=64)
    season = serializers.IntegerField(required=False, min_value=1950, max_value=2100)
