from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.core.api.serializers import HealthSerializer
from stintline.core.services import build_health_report


class HealthView(APIView):
    """Liveness and readiness of the API and its database."""

    @extend_schema(
        operation_id="health_retrieve",
        summary="API health",
        responses={200: HealthSerializer, 503: HealthSerializer},
        tags=["core"],
    )
    def get(self, request: Request) -> Response:
        report = build_health_report(settings.STINTLINE_VERSION)
        code = status.HTTP_200_OK if report.status == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
        response = Response(HealthSerializer(report).data, status=code)
        response["Cache-Control"] = "no-store"
        return response
