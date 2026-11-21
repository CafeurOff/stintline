"""Calendar and events."""

from __future__ import annotations

from typing import Any, Literal

from django.utils import timezone
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
from stintline.racing.timeline import replay_state


class WinnerSerializer(serializers.ModelSerializer[SessionEntry]):
    driver = DriverSerializer(read_only=True)
    team = TeamSerializer(read_only=True)

    class Meta:
        model = SessionEntry
        fields = ["car_number", "driver", "team", "team_colour"]


class SessionSummarySerializer(serializers.ModelSerializer[Session]):
    has_data = serializers.BooleanField(read_only=True)
    replay = serializers.SerializerMethodField(
        help_text=(
            "ready: the replay opens; pending: finished, timing being imported; upcoming: "
            "not finished yet; none: no lap timing exists for it (before 2023)"
        )
    )

    class Meta:
        model = Session
        fields = ["id", "kind", "scheduled_start", "ends_at", "has_data", "replay"]

    def get_replay(self, session: Session) -> Literal["ready", "pending", "upcoming", "none"]:
        return replay_state(session, bool(getattr(session, "has_data", False)), timezone.now())


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
