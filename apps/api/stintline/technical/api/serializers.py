from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.racing.api.serializers.common import DriverSerializer, TeamSerializer


class SeasonQuerySerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField(min_value=1950, max_value=2100)


class EventRefSerializer(serializers.Serializer[Any]):
    event_id = serializers.IntegerField()
    round = serializers.IntegerField()
    name = serializers.CharField()
    country = serializers.CharField()


class UpgradeCellSerializer(serializers.Serializer[Any]):
    event_id = serializers.IntegerField()
    round = serializers.IntegerField()
    count = serializers.IntegerField()
    performance = serializers.IntegerField(help_text="Items declared for performance")
    pace_before_pct = serializers.FloatField(
        allow_null=True, help_text="Median gap to the field (%) over the 3 races before"
    )
    pace_after_pct = serializers.FloatField(
        allow_null=True, help_text="Median gap to the field (%) from the upgrade race on (3)"
    )
    races_before = serializers.IntegerField()
    races_after = serializers.IntegerField()


class TeamUpgradesSerializer(serializers.Serializer[Any]):
    team = TeamSerializer(allow_null=True)
    team_name = serializers.CharField()
    colour = serializers.CharField(allow_null=True)
    upgrades = serializers.IntegerField()
    cells = UpgradeCellSerializer(many=True)


class UpgradeSerializer(serializers.Serializer[Any]):
    id = serializers.IntegerField()
    document_id = serializers.IntegerField()
    event_id = serializers.IntegerField()
    round = serializers.IntegerField()
    team_ref = serializers.CharField(allow_null=True)
    team_name = serializers.CharField()
    number = serializers.IntegerField()
    component = serializers.CharField()
    zone = serializers.CharField()
    reason = serializers.CharField()
    reason_detail = serializers.CharField()
    difference = serializers.CharField()
    description = serializers.CharField()


class UpgradesSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    rounds = EventRefSerializer(many=True)
    teams = TeamUpgradesSerializer(many=True)
    upgrades = UpgradeSerializer(many=True)


class PuChangeSerializer(EventRefSerializer):
    element = serializers.CharField()
    number = serializers.IntegerField()
    allowed = serializers.IntegerField(allow_null=True)
    compliant = serializers.BooleanField(allow_null=True)


class PuCarSerializer(serializers.Serializer[Any]):
    car_number = serializers.IntegerField()
    driver = DriverSerializer(allow_null=True)
    team_and_driver = serializers.CharField(source="label", help_text="As printed by the FIA")
    colour = serializers.CharField(allow_null=True)
    used = serializers.DictField(child=serializers.IntegerField())
    over = serializers.ListField(child=serializers.CharField(), help_text="Beyond the allowance")
    beyond = serializers.IntegerField(help_text="New elements stated as not in compliance")
    changes = PuChangeSerializer(many=True)


class PowerUnitsSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    as_of = EventRefSerializer()
    document_id = serializers.IntegerField()
    elements = serializers.ListField(child=serializers.CharField())
    allowed = serializers.DictField(
        child=serializers.IntegerField(), help_text="Allowance per element as the FIA states it"
    )
    cars = PuCarSerializer(many=True)


class IncidentKindSerializer(serializers.Serializer[Any]):
    kind = serializers.CharField()
    decisions = serializers.IntegerField()
    penalties = serializers.IntegerField()


class IncidentDriverSerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    colour = serializers.CharField(allow_null=True)
    decisions = serializers.IntegerField()
    penalties = serializers.IntegerField()
    points = serializers.IntegerField(help_text="Penalty points given this season")
    points_12m = serializers.IntegerField(help_text="Points on the licence after the last round")
    points_by_round = serializers.ListField(child=serializers.IntegerField())
    kinds = serializers.DictField(child=serializers.IntegerField())


class IncidentSerializer(EventRefSerializer):
    document_id = serializers.IntegerField()
    driver = DriverSerializer(allow_null=True)
    driver_name = serializers.CharField()
    colour = serializers.CharField(allow_null=True)
    session_label = serializers.CharField()
    lap = serializers.IntegerField(allow_null=True)
    kind = serializers.CharField()
    fact = serializers.CharField()
    is_penalty = serializers.BooleanField()
    time_penalty_s = serializers.IntegerField()
    grid_places = serializers.IntegerField()
    penalty_points = serializers.IntegerField()
    drive_through = serializers.BooleanField()
    stop_go_s = serializers.IntegerField()
    back_of_grid = serializers.BooleanField()
    pit_lane_start = serializers.BooleanField()
    reprimand = serializers.BooleanField()
    fine_eur = serializers.IntegerField()
    disqualified = serializers.BooleanField()
    lap_time_deleted = serializers.BooleanField()
    no_further_action = serializers.BooleanField()


class IncidentsSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    threshold = serializers.IntegerField(help_text="Points in 12 months that bring a race ban")
    rounds = EventRefSerializer(many=True)
    kinds = IncidentKindSerializer(many=True)
    drivers = IncidentDriverSerializer(many=True)
    decisions = IncidentSerializer(many=True)
