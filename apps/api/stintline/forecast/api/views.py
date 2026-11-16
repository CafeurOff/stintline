from __future__ import annotations

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.forecast import selectors
from stintline.forecast.api.serializers import ForecastQuerySerializer, SessionForecastSerializer

CACHE_S = 15 * 60
"""Forecasts are refreshed every 3 hours: a short client cache is enough."""


class ForecastListView(APIView):
    @extend_schema(
        operation_id="forecasts_list",
        summary="Weather forecasts of upcoming sessions (Open-Meteo, CC BY 4.0)",
        parameters=[OpenApiParameter("event", int, description="Only this Grand Prix")],
        responses=SessionForecastSerializer(many=True),
        tags=["forecasts"],
    )
    def get(self, request: Request) -> Response:
        query = ForecastQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        rows = selectors.forecasts(timezone.now(), query.validated_data.get("event"))
        response = Response(SessionForecastSerializer(rows, many=True).data)
        response["Cache-Control"] = f"public, max-age={CACHE_S}"
        return response
