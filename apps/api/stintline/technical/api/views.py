from __future__ import annotations

from collections.abc import Callable
from typing import Any

from django.db.models import Max
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.analysis.models import RaceStats
from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.paddock.models import FiaDocument
from stintline.technical import selectors
from stintline.technical.api import serializers as s

TAG = ["technical"]
ERRORS: dict[int, Any] = {400: ProblemSerializer, 404: ProblemSerializer}


def _season(request: Request) -> int:
    query = s.SeasonQuerySerializer(data=request.query_params)
    query.is_valid(raise_exception=True)
    return int(query.validated_data["season"])


def _stamp() -> tuple[object, object]:
    documents = FiaDocument.objects.aggregate(read=Max("text_fetched_at"))["read"]
    figures = RaceStats.objects.aggregate(built=Max("built_at"))["built"]
    return documents, figures


def _view(
    request: Request,
    name: str,
    build: Callable[[int], dict[str, Any] | None],
    serializer: type[serializers.Serializer[Any]],
    missing: str,
) -> Response:
    season = _season(request)
    result = build(season)
    if result is None:
        raise NotFound(missing)
    return cached_response(request, serializer(result).data, name, season, *_stamp())


class UpgradesView(APIView):
    @extend_schema(
        operation_id="technical_upgrades_retrieve",
        summary="Upgrades declared by the teams, with the race pace before and after them",
        parameters=[s.SeasonQuerySerializer],
        responses={200: s.UpgradesSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        return _view(
            request, "upgrades", selectors.upgrades, s.UpgradesSerializer, "No upgrades read."
        )


class PowerUnitsView(APIView):
    @extend_schema(
        operation_id="technical_power_units_retrieve",
        summary="Power-unit elements used by each car against the season's allowance",
        parameters=[s.SeasonQuerySerializer],
        responses={200: s.PowerUnitsSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        return _view(
            request,
            "power-units",
            selectors.power_units,
            s.PowerUnitsSerializer,
            "No power-unit report read.",
        )


class IncidentsView(APIView):
    @extend_schema(
        operation_id="technical_incidents_retrieve",
        summary="Stewards' decisions by kind and penalty points on the licence",
        parameters=[s.SeasonQuerySerializer],
        responses={200: s.IncidentsSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        return _view(
            request, "incidents", selectors.incidents, s.IncidentsSerializer, "No decision read."
        )
