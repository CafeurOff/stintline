"""Calendar and events."""

from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.racing.api.serializers.common import (
    CircuitSerializer,
    DriverSerializer,
    TeamSerializer,
)
from stintline.racing.models import (
    Event,
    Session,
    SessionEntry,
    SessionKind,
)


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

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # One instance for every event, so official photos load once per response.
        self._winner = WinnerSerializer()

    @extend_schema_field(WinnerSerializer(allow_null=True))
    def get_winner(self, event: Event) -> dict[str, Any] | None:
        """Needs ``selectors.season_events`` (sessions prefetched with ``winners``)."""
        for session in event.sessions.all():
            if session.kind == SessionKind.RACE:
                winners = getattr(session, "winners", [])
                return self._winner.to_representation(winners[0]) if winners else None
        return None
