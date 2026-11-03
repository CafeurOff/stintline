from __future__ import annotations

from dataclasses import asdict
from typing import Any

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.racing.models import Session
from stintline.strategy_api import services
from stintline.strategy_api.api import serializers as s

ERRORS: dict[int, Any] = {400: ProblemSerializer, 404: ProblemSerializer}


def _context(session_id: int) -> tuple[Session, services.RaceContext]:
    session = get_object_or_404(Session.objects.select_related("event__season"), pk=session_id)
    try:
        return session, services.race_context(session)
    except services.StrategyInputError as exc:
        raise ValidationError({"session": [str(exc)]}) from exc


def _query(serializer_class: type[serializers.Serializer[Any]], request: Request) -> dict[str, Any]:
    serializer = serializer_class(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def _run(fn: Any, *args: Any, **kwargs: Any) -> Any:
    try:
        return fn(*args, **kwargs)
    except services.StrategyInputError as exc:
        raise ValidationError({"non_field_errors": [str(exc)]}) from exc


TAG = ["strategy"]
CARS_PARAM = OpenApiParameter("cars", str, description="Comma-separated car numbers, e.g. `1,4`")


class SessionLapsView(APIView):
    @extend_schema(
        operation_id="session_laps_list",
        summary="Laps with fuel-corrected times and exclusion reasons",
        parameters=[CARS_PARAM],
        responses={200: s.LapSerializer(many=True), **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, session_id: int) -> Response:
        cars = _query(s.CarsQuerySerializer, request)["cars"]
        session, context = _context(session_id)
        data = _run(services.laps, context, cars)
        return cached_response(
            request, data, "laps", session_id, cars, services.context_version(session)
        )


class SessionReplayView(APIView):
    @extend_schema(
        operation_id="session_replay_retrieve",
        summary="Line-crossing times, compounds and tyre ages of every car on every lap",
        responses={200: s.ReplaySerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, session_id: int) -> Response:
        session, context = _context(session_id)
        data = s.ReplaySerializer(services.replay(context)).data
        return cached_response(
            request, data, "replay", session_id, services.context_version(session)
        )


class SessionDegradationView(APIView):
    @extend_schema(
        operation_id="session_degradation_retrieve",
        summary="Tyre degradation per compound and per stint",
        parameters=[OpenApiParameter("cars", str, required=False)],
        responses={200: s.DegradationSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, session_id: int) -> Response:
        cars = _query(s.OptionalCarsQuerySerializer, request).get("cars")
        session, context = _context(session_id)
        data = _run(services.degradation, context, cars)
        return cached_response(
            request, data, "deg", session_id, cars, services.context_version(session)
        )


class SessionPitLossView(APIView):
    @extend_schema(
        operation_id="session_pit_loss_retrieve",
        summary="Pit loss measured from the session's stops",
        responses={200: s.PitLossSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, session_id: int) -> Response:
        session, context = _context(session_id)
        data = _run(services.pit_loss, context)
        return cached_response(
            request, data, "pitloss", session_id, services.context_version(session)
        )


class SessionCompareView(APIView):
    @extend_schema(
        operation_id="session_compare_retrieve",
        summary="Lap-by-lap comparison of two cars",
        parameters=[OpenApiParameter("a", int), OpenApiParameter("b", int)],
        responses={200: s.CompareSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request, session_id: int) -> Response:
        params = _query(s.CompareQuerySerializer, request)
        session, context = _context(session_id)
        data = _run(services.compare, context, params["a"], params["b"])
        return cached_response(
            request,
            data,
            "cmp",
            session_id,
            params["a"],
            params["b"],
            services.context_version(session),
        )


class UndercutView(APIView):
    throttle_scope = "simulate"

    @extend_schema(
        operation_id="simulate_undercut",
        summary="Simulate an undercut: attacker pits first, defender reacts",
        request=s.UndercutRequestSerializer,
        responses={200: s.UndercutResultSerializer, **ERRORS},
        tags=TAG,
    )
    def post(self, request: Request, session_id: int) -> Response:
        body = s.UndercutRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        _, context = _context(session_id)
        result = _run(services.simulate_undercut, context, **body.validated_data)
        data = {
            **{k: v for k, v in asdict(result).items() if k != "lap_gaps_s"},
            "attacker_ahead": result.attacker_ahead,
            "lap_gaps": [{"lap": lap, "gap_s": gap} for lap, gap in result.lap_gaps_s],
        }
        return Response(s.UndercutResultSerializer(data).data, status=status.HTTP_200_OK)


class PitExitView(APIView):
    throttle_scope = "simulate"

    @extend_schema(
        operation_id="simulate_pit_exit",
        summary="Predict where a car rejoins after pitting on a given lap",
        request=s.PitExitRequestSerializer,
        responses={200: s.PitExitResultSerializer, **ERRORS},
        tags=TAG,
    )
    def post(self, request: Request, session_id: int) -> Response:
        body = s.PitExitRequestSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        params = body.validated_data
        _, context = _context(session_id)
        prediction = _run(
            services.simulate_pit_exit,
            context,
            car=params["car"],
            pit_lap=params["pit_lap"],
            neutralisation=params.get("neutralisation"),
            rival_stops={r["car"]: r["lap"] for r in params.get("rival_stops", [])},
        )
        data = asdict(prediction)
        data["rivals"] = [asdict(r) for r in prediction.rivals]
        return Response(s.PitExitResultSerializer(data).data)


class ModelCardView(APIView):
    @extend_schema(
        operation_id="model_retrieve",
        summary="Model assumptions and backtest results",
        responses=s.ModelCardSerializer,
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        card = services.model_card()
        return cached_response(request, card, "model", card["engine_version"])
