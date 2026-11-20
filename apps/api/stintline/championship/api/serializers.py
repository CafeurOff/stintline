from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.championship.maths import Status
from stintline.racing.api.serializers.common import DriverSerializer


class CountBlockSerializer(serializers.Serializer[Any]):
    races = serializers.IntegerField(
        allow_null=True, help_text="Grands Prix in this part of the season; null: all the rest"
    )
    best = serializers.IntegerField(
        allow_null=True, help_text="Results that count among them; null: every one"
    )


class RulesSerializer(serializers.Serializer[Any]):
    race_max = serializers.FloatField(
        help_text="Most points from one Grand Prix (win, fastest lap)"
    )
    sprint_max = serializers.FloatField()
    all_count = serializers.BooleanField(help_text="False when only the best results counted")
    blocks = CountBlockSerializer(many=True)
    double_last_race = serializers.BooleanField()


class RoundRefSerializer(serializers.Serializer[Any]):
    round = serializers.IntegerField(source="number")
    event_id = serializers.IntegerField()
    name = serializers.CharField()
    race_date = serializers.DateField()
    sprint = serializers.BooleanField()


class TitleDriverSerializer(serializers.Serializer[Any]):
    driver = DriverSerializer()
    points = serializers.FloatField(help_text="Points that count (after dropped results)")
    scored = serializers.FloatField(help_text="Every point scored, dropped results included")
    ceiling = serializers.FloatField(help_text="Most points the driver can still finish with")
    gap = serializers.FloatField(help_text="Points behind the leader")
    status = serializers.ChoiceField(choices=[(s.value, s.value) for s in Status])
    clinch_margin = serializers.FloatField(
        allow_null=True,
        help_text="At the next round the leader is champion if he outscores this driver by "
        "more than this (negative: may even lose that much); null when not in play",
    )


class TitleSerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField()
    rules = RulesSerializer()
    races_done = serializers.IntegerField()
    races_left = serializers.IntegerField()
    sprints_left = serializers.IntegerField()
    points_left = serializers.FloatField(help_text="Most points one driver can still score")
    decided = RoundRefSerializer(
        allow_null=True, help_text="Round after which the title was settled by arithmetic"
    )
    next_round = RoundRefSerializer(allow_null=True)
    drivers = TitleDriverSerializer(many=True)
