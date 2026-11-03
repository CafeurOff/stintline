from __future__ import annotations

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.racing import selectors
from stintline.racing.api.serializers import (
    EntryStintsSerializer,
    EventSerializer,
    SeasonSerializer,
    SessionDetailSerializer,
    TrackSerializer,
)
from stintline.racing.geometry import normalise_outline
from stintline.racing.models import Event, Season, Session


class SeasonListView(generics.ListAPIView[Season]):
    """Seasons with stored events, most recent first."""

    serializer_class = SeasonSerializer

    def get_queryset(self) -> QuerySet[Season]:
        return selectors.seasons()

    @extend_schema(operation_id="seasons_list", tags=["racing"])
    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().get(request, *args, **kwargs)


class SeasonEventListView(generics.ListAPIView[Event]):
    """Grands Prix of a season with their sessions (``has_data`` = timing ingested)."""

    serializer_class = EventSerializer

    def get_queryset(self) -> QuerySet[Event]:
        return selectors.season_events(int(self.kwargs["year"]))

    @extend_schema(operation_id="season_events_list", tags=["racing"])
    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().get(request, *args, **kwargs)


def _session_or_404(session_id: int) -> Session:
    return get_object_or_404(Session.objects.only("id", "ingested_at"), pk=session_id)


class SessionDetailView(APIView):
    @extend_schema(
        operation_id="session_retrieve",
        summary="Session with entries, media and neutralised periods",
        responses=SessionDetailSerializer,
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        stamp = _session_or_404(session_id).ingested_at
        session = selectors.session_detail(session_id)
        return cached_response(
            request, SessionDetailSerializer(session).data, "session", session_id, stamp
        )


class SessionStintsView(APIView):
    @extend_schema(
        operation_id="session_stints_list",
        summary="Stints and pit stops of every car, in classification order",
        responses=EntryStintsSerializer(many=True),
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        stamp = _session_or_404(session_id).ingested_at
        data = EntryStintsSerializer(selectors.session_stints(session_id), many=True).data
        return cached_response(request, data, "stints", session_id, stamp)


class SessionTrackView(APIView):
    @extend_schema(
        operation_id="session_track_retrieve",
        summary="Circuit outline drawn from a reference lap, in screen coordinates",
        responses={200: TrackSerializer, 404: ProblemSerializer},
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        stamp = _session_or_404(session_id).ingested_at
        outline = selectors.track_outline(session_id)
        if outline is None:
            raise NotFound("No circuit outline for this session.")
        shape = normalise_outline(outline.points)
        data = TrackSerializer(
            {
                "width": shape.width,
                "height": shape.height,
                "car_number": outline.car_number,
                "lap_number": outline.lap_number,
                "lap_time_s": outline.lap_time_s,
                "points": shape.points,
            }
        ).data
        return cached_response(request, data, "track", session_id, stamp)
