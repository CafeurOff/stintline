from __future__ import annotations

from typing import Any

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from stintline.paddock.models import DocumentCategory, FiaDocument, StewardsDecision
from stintline.paddock.selectors import snippet
from stintline.racing.api.serializers import DriverSerializer, TeamSerializer
from stintline.racing.models import Event


class DocumentQuerySerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField(required=False, min_value=1950, max_value=2100)
    event = serializers.IntegerField(required=False, min_value=1, help_text="Event id")
    category = serializers.ChoiceField(choices=DocumentCategory.choices, required=False)
    car = serializers.IntegerField(required=False, min_value=1, max_value=99)
    q = serializers.CharField(required=False, max_length=120, help_text="Full-text search")
    limit = serializers.IntegerField(required=False, min_value=1, max_value=100, default=40)
    offset = serializers.IntegerField(required=False, min_value=0, default=0)


class DecisionQuerySerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField(required=False, min_value=1950, max_value=2100)
    event = serializers.IntegerField(required=False, min_value=1)
    driver = serializers.SlugField(required=False, help_text="Driver ref")


class SeasonOnlySerializer(serializers.Serializer[Any]):
    season = serializers.IntegerField(min_value=1950, max_value=2100)


class DocumentEventSerializer(serializers.ModelSerializer[Event]):
    season = serializers.IntegerField(source="season.year")
    country = serializers.CharField(source="circuit.country")

    class Meta:
        model = Event
        fields = ["id", "season", "round", "name", "country", "race_date"]


PENALTY_FIELDS = [
    "time_penalty_s",
    "drive_through",
    "stop_go_s",
    "grid_places",
    "back_of_grid",
    "pit_lane_start",
    "penalty_points",
    "reprimand",
    "fine_eur",
    "disqualified",
    "lap_time_deleted",
    "no_further_action",
]


class DecisionBriefSerializer(serializers.ModelSerializer[StewardsDecision]):
    driver = DriverSerializer(allow_null=True)
    is_penalty = serializers.BooleanField()
    session_kind = serializers.CharField(source="session.kind", allow_null=True, default=None)

    class Meta:
        model = StewardsDecision
        fields = [
            "car_number",
            "driver",
            "driver_name",
            "session_label",
            "session_kind",
            "lap",
            "incident_time",
            "fact",
            "decision",
            "is_penalty",
            *PENALTY_FIELDS,
        ]


class DocumentSerializer(serializers.ModelSerializer[FiaDocument]):
    event = DocumentEventSerializer()
    has_text = serializers.SerializerMethodField()
    snippet = serializers.SerializerMethodField(help_text="Passage around a searched word")
    decision = serializers.SerializerMethodField()

    class Meta:
        model = FiaDocument
        fields = [
            "id",
            "event",
            "number",
            "title",
            "category",
            "published_at",
            "url",
            "cars",
            "has_text",
            "snippet",
            "decision",
        ]

    def get_has_text(self, document: FiaDocument) -> bool:
        return bool(document.text)

    def get_snippet(self, document: FiaDocument) -> str | None:
        return snippet(document.text, self.context.get("search"))

    @extend_schema_field(DecisionBriefSerializer(allow_null=True))
    def get_decision(self, document: FiaDocument) -> dict[str, Any] | None:
        decision = getattr(document, "decision", None)
        return None if decision is None else DecisionBriefSerializer(decision).data


class DocumentDetailSerializer(DocumentSerializer):
    text = serializers.CharField(help_text="Text extracted from the PDF (empty until read)")
    reason = serializers.SerializerMethodField()
    infringement = serializers.SerializerMethodField()

    class Meta(DocumentSerializer.Meta):
        fields = [*DocumentSerializer.Meta.fields, "text", "reason", "infringement"]

    def get_reason(self, document: FiaDocument) -> str | None:
        decision = getattr(document, "decision", None)
        return decision.reason if decision else None

    def get_infringement(self, document: FiaDocument) -> str | None:
        decision = getattr(document, "decision", None)
        return decision.infringement if decision else None


class DocumentPageSerializer(serializers.Serializer[Any]):
    count = serializers.IntegerField()
    results = DocumentSerializer(many=True)


class EventDocumentsSerializer(serializers.Serializer[Any]):
    event = DocumentEventSerializer()
    documents = serializers.IntegerField()
    decisions = serializers.IntegerField()
    penalties = serializers.IntegerField()


class DecisionSerializer(DecisionBriefSerializer):
    document_id = serializers.IntegerField(source="document.pk")
    document_number = serializers.IntegerField(source="document.number")
    title = serializers.CharField(source="document.title")
    published_at = serializers.DateTimeField(source="document.published_at")
    event = DocumentEventSerializer(source="document.event")
    session_id = serializers.IntegerField(source="session.pk", allow_null=True, default=None)
    infringement = serializers.CharField()
    colour = serializers.SerializerMethodField()
    team = serializers.SerializerMethodField()

    class Meta(DecisionBriefSerializer.Meta):
        fields = [
            "document_id",
            "document_number",
            "title",
            "published_at",
            "event",
            "session_id",
            "infringement",
            "colour",
            "team",
            *DecisionBriefSerializer.Meta.fields,
        ]

    def _team(self, decision: StewardsDecision) -> dict[str, Any] | None:
        colours: dict[tuple[int, int], dict[str, Any]] = self.context.get("teams", {})
        if decision.car_number is None:
            return None
        return colours.get((decision.document.event_id, decision.car_number))

    def get_colour(self, decision: StewardsDecision) -> str | None:
        found = self._team(decision)
        return found["colour"] if found else None

    @extend_schema_field(TeamSerializer(allow_null=True))
    def get_team(self, decision: StewardsDecision) -> dict[str, Any] | None:
        found = self._team(decision)
        return TeamSerializer(found["team"]).data if found else None
