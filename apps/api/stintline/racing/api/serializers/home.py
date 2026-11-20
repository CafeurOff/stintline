"""The home page: last race, next event and both championships."""

from __future__ import annotations

from typing import Any

from rest_framework import serializers

from stintline.racing.api.serializers.calendar import EventSerializer, EventSummarySerializer
from stintline.racing.api.serializers.sessions import EntrySerializer
from stintline.racing.api.serializers.standings import StandingLineSerializer


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
