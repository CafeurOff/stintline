from __future__ import annotations

from django.db.models import Max, QuerySet
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.racing import careers, selectors
from stintline.racing.api.serializers import (
    DriverBioSerializer,
    DriverCareerSerializer,
    DriverQuerySerializer,
    DriverResultSerializer,
    EntryStintsSerializer,
    EventSerializer,
    RoundQuerySerializer,
    SeasonSerializer,
    SessionDetailSerializer,
    StandingsSerializer,
    TeamRadioSerializer,
    TrackSerializer,
)
from stintline.racing.geometry import normalise_outline
from stintline.racing.models import Driver, Event, Season, Session, SessionEntry, TeamRadio


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


class DriverListView(generics.ListAPIView[Driver]):
    """Every driver since 1950, searchable by name or code, optionally limited to a season."""

    serializer_class = DriverBioSerializer

    def get_queryset(self) -> QuerySet[Driver]:
        params = DriverQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        return careers.search_drivers(
            params.validated_data.get("search"), params.validated_data.get("season")
        )

    @extend_schema(
        operation_id="drivers_list",
        parameters=[
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("season", int, required=False),
        ],
        tags=["drivers"],
    )
    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().get(request, *args, **kwargs)


def _data_stamp() -> str:
    """Changes whenever results or timing are imported: the cache key of derived stats."""
    seasons = Season.objects.aggregate(last=Max("results_ingested_at"))["last"]
    sessions = Session.objects.aggregate(last=Max("ingested_at"))["last"]
    return f"{seasons}-{sessions}"


class DriverCareerView(APIView):
    @extend_schema(
        operation_id="driver_retrieve",
        summary="Driver biography, career totals and season-by-season record",
        responses={200: DriverCareerSerializer, 404: ProblemSerializer},
        tags=["drivers"],
    )
    def get(self, request: Request, ref: str) -> Response:
        driver = get_object_or_404(Driver, ref=ref)
        data = DriverCareerSerializer(careers.driver_career(driver)).data
        return cached_response(request, data, "driver", ref, _data_stamp())


class DriverResultsView(generics.ListAPIView[SessionEntry]):
    """Race and sprint results of a driver, most recent first."""

    serializer_class = DriverResultSerializer

    def get_queryset(self) -> QuerySet[SessionEntry]:
        driver = get_object_or_404(Driver, ref=self.kwargs["ref"])
        params = DriverQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        return careers.driver_results(driver, params.validated_data.get("season"))

    @extend_schema(
        operation_id="driver_results_list",
        parameters=[OpenApiParameter("season", int, required=False)],
        tags=["drivers"],
    )
    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().get(request, *args, **kwargs)


class SeasonStandingsView(APIView):
    @extend_schema(
        operation_id="season_standings_retrieve",
        summary="Drivers' and constructors' championships after a round (default: latest)",
        parameters=[OpenApiParameter("round", int, required=False)],
        responses={200: StandingsSerializer, 404: ProblemSerializer},
        tags=["racing"],
    )
    def get(self, request: Request, year: int) -> Response:
        params = RoundQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        chosen, rounds, rows = careers.standings(year, params.validated_data.get("round"))
        if chosen is None:
            raise NotFound("No standings for this season.")
        data = StandingsSerializer(
            {
                "season": year,
                "round": chosen,
                "rounds": rounds,
                "drivers": [r for r in rows if r.driver_id is not None],
                "constructors": [r for r in rows if r.team_id is not None],
            }
        ).data
        return cached_response(request, data, "standings", year, chosen, _data_stamp())


class SessionRadioView(APIView):
    @extend_schema(
        operation_id="session_radio_list",
        summary="Team radio messages (references to the official recordings)",
        responses=TeamRadioSerializer(many=True),
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        stamp = _session_or_404(session_id).ingested_at
        rows = TeamRadio.objects.filter(session_id=session_id).order_by("recorded_at")
        return cached_response(
            request, TeamRadioSerializer(rows, many=True).data, "radio", session_id, stamp
        )
