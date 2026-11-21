"""Driver lists, careers and results."""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.racing.api.serializers.common import (
    MediaSerializer,
    PortraitSerializer,
    TeamSerializer,
    portrait_of,
)
from stintline.racing.careers import FormRace
from stintline.racing.models import (
    Driver,
    SessionEntry,
)
from stintline.racing.photos import PhotoBook
from stintline.racing.portraits import relay_url


class DriverBioSerializer(serializers.ModelSerializer[Driver]):
    portrait = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField(
        help_text="Photo to show: latest official portrait if enabled, else the Wikipedia one"
    )

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
            "photo_url",
        ]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._photos = PhotoBook()

    @extend_schema_field(PortraitSerializer(allow_null=True))
    def get_portrait(self, driver: Driver) -> dict[str, Any] | None:
        portrait = portrait_of(driver)
        return PortraitSerializer(portrait).data if portrait else None

    def get_photo_url(self, driver: Driver) -> str | None:
        portrait = portrait_of(driver)
        return self._photos.photo_of(driver, relay_url(portrait) if portrait else None)


class LatestTeamSerializer(serializers.Serializer[Any]):
    ref = serializers.CharField()
    name = serializers.CharField()
    colour = serializers.CharField(allow_null=True)


class SeasonDriverSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    position = serializers.IntegerField(allow_null=True)
    points = serializers.FloatField(allow_null=True)


class DriverListItemSerializer(DriverBioSerializer):
    team = serializers.SerializerMethodField(
        help_text="Team of the latest race (in the requested season, if any)"
    )
    season = serializers.SerializerMethodField(
        help_text="Car number and championship place in the requested season"
    )

    class Meta(DriverBioSerializer.Meta):
        fields = [*DriverBioSerializer.Meta.fields, "team", "season"]

    @extend_schema_field(SeasonDriverSerializer(allow_null=True))
    def get_season(self, driver: Driver) -> dict[str, Any] | None:
        card = self.context.get("season_drivers", {}).get(driver.pk)
        return None if card is None else SeasonDriverSerializer(card).data

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
    latest_team = LatestTeamSerializer(allow_null=True, help_text="Team of the latest race")
    latest_car_number = serializers.IntegerField(allow_null=True)
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


class DriverQuerySerializer(serializers.Serializer[Any]):
    search = serializers.CharField(required=False, max_length=64)
    season = serializers.IntegerField(required=False, min_value=1950, max_value=2100)


class FormTeammateSerializer(serializers.ModelSerializer[Driver]):
    class Meta:
        model = Driver
        fields = ["ref", "code", "given_name", "family_name"]


class FormRaceSerializer(serializers.Serializer[Any]):
    session_id = serializers.IntegerField(source="entry.session.id")
    event_id = serializers.IntegerField(source="entry.session.event.id")
    has_data = serializers.SerializerMethodField(help_text="Lap timing stored for this race")
    season = serializers.IntegerField(source="entry.session.event.season.year")
    round = serializers.IntegerField(source="entry.session.event.round")
    event_name = serializers.CharField(source="entry.session.event.name")
    country = serializers.CharField(source="entry.session.event.circuit.country")
    race_date = serializers.DateField(source="entry.session.event.race_date")
    team = TeamSerializer(source="entry.team")
    grid_position = serializers.IntegerField(
        source="entry.grid_position", allow_null=True, help_text="0: pit-lane start"
    )
    finish_position = serializers.IntegerField(source="entry.finish_position", allow_null=True)
    classification = serializers.CharField(source="entry.classification")
    status = serializers.CharField(source="entry.status")
    points = serializers.FloatField(source="entry.points")
    teammate = serializers.SerializerMethodField(
        help_text="The other car of the same team in that race (a stand-in counts)"
    )
    pace_gap_s = serializers.FloatField(
        allow_null=True,
        help_text="Fuel-corrected median clean lap minus the teammate's, s/lap (negative: "
        "quicker); null without timing or with too few clean laps for either car",
    )

    def get_has_data(self, race: FormRace) -> bool:
        return race.entry.session.ingested_at is not None

    @extend_schema_field(FormTeammateSerializer(allow_null=True))
    def get_teammate(self, race: FormRace) -> dict[str, Any] | None:
        if race.teammate is None:
            return None
        return dict(FormTeammateSerializer(race.teammate.driver).data)


class DriverFormSerializer(serializers.Serializer[Any]):
    min_clean_laps = serializers.IntegerField(
        help_text="Clean laps both cars need before a pace gap is given"
    )
    races = FormRaceSerializer(many=True, help_text="Last Grands Prix started, oldest first")
