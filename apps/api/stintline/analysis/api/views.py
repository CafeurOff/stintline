from __future__ import annotations

from typing import Any

from django.db.models import Max
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.analysis import circuits, duels, pace, season
from stintline.analysis.api import serializers as s
from stintline.analysis.models import RaceStats
from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.racing.models import Driver, Season, Session
from stintline.strategy_api import services
from stintline_strategy.analysis import PaceFilter

ERRORS: dict[int, Any] = {400: ProblemSerializer, 404: ProblemSerializer}
TAG = ["analysis"]
SEASON_PARAM = OpenApiParameter("season", int, description="Season, e.g. `2025`")


def _query(serializer_class: type[serializers.Serializer[Any]], request: Request) -> dict[str, Any]:
    serializer = serializer_class(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def _stamp(year: int | None = None) -> tuple[object, ...]:
    """Version of the stored figures (and of the season's results, when given)."""
    built = RaceStats.objects.aggregate(last=Max("built_at"))["last"]
    if year is None:
        return (built,)
    results = Season.objects.filter(year=year).values_list("results_ingested_at", flat=True)
    return (built, year, results.first())


class HeadToHeadView(APIView):
    @extend_schema(
        operation_id="analysis_head_to_head_retrieve",
        summary="Two drivers over a season: qualifying, race and fuel-corrected pace duels",
        parameters=[
            SEASON_PARAM,
            OpenApiParameter("a", str, description="Driver ref, e.g. `norris`"),
            OpenApiParameter("b", str, description="Driver ref, e.g. `piastri`"),
        ],
        responses={200: s.HeadToHeadSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        query = _query(s.HeadToHeadQuerySerializer, request)
        a = get_object_or_404(Driver, ref=query["a"])
        b = get_object_or_404(Driver, ref=query["b"])
        result = duels.head_to_head(query["season"], a.pk, b.pk)
        if result is None:
            raise NotFound("Both drivers must have started a race that season.")
        data = s.HeadToHeadSerializer(result).data
        return cached_response(request, data, "h2h", a.pk, b.pk, *_stamp(query["season"]))


class TeammatesView(APIView):
    @extend_schema(
        operation_id="analysis_teammates_list",
        summary="Every team's teammate duel over a season, best-scoring team first",
        responses={200: s.TeammatesSerializer(many=True), **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, year: int) -> Response:
        result = duels.teammates(year)
        if not result:
            raise NotFound("No race results for this season.")
        data = s.TeammatesSerializer(result, many=True).data
        return cached_response(request, data, "teammates", *_stamp(year))


class ConsistencyView(APIView):
    @extend_schema(
        operation_id="analysis_consistency_list",
        summary="Drivers ranked by lap-to-lap scatter once tyre wear is removed (2023+)",
        responses={200: s.ConsistencySerializer(many=True), **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, year: int) -> Response:
        result = season.consistency(year)
        if not result:
            raise NotFound("No timed races for this season.")
        data = s.ConsistencySerializer(result, many=True).data
        return cached_response(request, data, "consistency", *_stamp(year))


class PitStopsView(APIView):
    @extend_schema(
        operation_id="analysis_pit_stops_retrieve",
        summary="Fastest stops, team averages, pit loss and undercuts of a season (2023+)",
        responses={200: s.PitStopsSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, year: int) -> Response:
        result = season.pit_stops(year)
        if result is None:
            raise NotFound("No pit stops stored for this season.")
        data = s.PitStopsSerializer(result).data
        return cached_response(request, data, "pitstops", *_stamp(year))


class CircuitsView(APIView):
    @extend_schema(
        operation_id="analysis_circuits_list",
        summary="Track DNA of every circuit raced since 2023, from our own figures",
        responses={200: s.CircuitProfileSerializer(many=True)},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        data = s.CircuitProfileSerializer(circuits.circuit_profiles(), many=True).data
        return cached_response(request, data, "circuits", *_stamp())


class SessionPaceView(APIView):
    @extend_schema(
        operation_id="session_pace_retrieve",
        summary="Race pace of every car: box plots, laps and fastest laps, with filters",
        parameters=[
            OpenApiParameter("fuel", bool, description="Fuel-corrected times (default true)"),
            OpenApiParameter("pit", bool, description="Keep in-laps and out-laps"),
            OpenApiParameter("sc", bool, description="Keep neutralised and restart laps"),
            OpenApiParameter("cutoff", int, description="% of the fastest lap, 0 keeps all"),
        ],
        responses={200: s.SessionPaceSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, session_id: int) -> Response:
        query = _query(s.PaceQuerySerializer, request)
        session = get_object_or_404(Session.objects.select_related("event"), pk=session_id)
        flt = PaceFilter(
            include_pit_laps=query["pit"],
            include_neutralised=query["sc"],
            cutoff_pct=query["cutoff"],
            fuel_corrected=query["fuel"],
        )
        try:
            result = pace.session_pace(session, flt)
        except services.StrategyInputError as exc:
            raise ValidationError({"session": [str(exc)]}) from exc
        data = s.SessionPaceSerializer(result).data
        return cached_response(
            request,
            data,
            "pace",
            session_id,
            sorted(query.items()),
            services.context_version(session),
        )
