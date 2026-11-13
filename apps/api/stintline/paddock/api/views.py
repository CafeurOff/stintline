from __future__ import annotations

from typing import Any

from django.db.models import Max
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, Throttled
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from racedata.errors import ProviderError
from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.paddock import relay, selectors
from stintline.paddock.api import serializers as s
from stintline.paddock.models import FiaDocument
from stintline.paddock.services import ThrottleBusyError

TAG = ["paddock"]
ERRORS: dict[int, Any] = {400: ProblemSerializer, 404: ProblemSerializer}
RETRY_AFTER_S = 10


class UpstreamError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "fia.com did not return the document."
    default_code = "upstream_unavailable"


def _query(serializer_class: type[serializers.Serializer[Any]], request: Request) -> dict[str, Any]:
    serializer = serializer_class(data=request.query_params)
    serializer.is_valid(raise_exception=True)
    return dict(serializer.validated_data)


def _stamp() -> tuple[object, object]:
    """Changes whenever documents are listed or read."""
    stamps = FiaDocument.objects.aggregate(listed=Max("listed_at"), read=Max("text_fetched_at"))
    return stamps["listed"], stamps["read"]


class DocumentListView(APIView):
    @extend_schema(
        operation_id="documents_list",
        summary="FIA event documents, newest first or by relevance with a search",
        parameters=[s.DocumentQuerySerializer],
        responses={200: s.DocumentPageSerializer, **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        query = _query(s.DocumentQuerySerializer, request)
        rows = selectors.documents(
            season=query.get("season"),
            event_id=query.get("event"),
            category=query.get("category"),
            car=query.get("car"),
            search=query.get("q"),
        )
        offset, limit = query["offset"], query["limit"]
        page = list(rows[offset : offset + limit])
        data = {
            "count": rows.count(),
            "results": s.DocumentSerializer(
                page, many=True, context={"search": query.get("q")}
            ).data,
        }
        return cached_response(request, data, "documents", sorted(query.items()), *_stamp())


class DocumentEventsView(APIView):
    @extend_schema(
        operation_id="documents_events_list",
        summary="Grands Prix of a season with documents, latest first, with counts",
        parameters=[s.SeasonOnlySerializer],
        responses={200: s.EventDocumentsSerializer(many=True), **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        season = _query(s.SeasonOnlySerializer, request)["season"]
        rows = selectors.event_summaries(season)
        data = s.EventDocumentsSerializer(
            [
                {
                    "event": r.event,
                    "documents": r.documents,
                    "decisions": r.decisions,
                    "penalties": r.penalties,
                }
                for r in rows
            ],
            many=True,
        ).data
        return cached_response(request, data, "document-events", season, *_stamp())


class DocumentDetailView(APIView):
    @extend_schema(
        operation_id="document_retrieve",
        summary="One FIA document with its text and, for decisions, the stewards' ruling",
        responses={200: s.DocumentDetailSerializer, 404: ProblemSerializer},
        tags=TAG,
    )
    def get(self, request: Request, document_id: int) -> Response:
        document = get_object_or_404(selectors.documents(), pk=document_id)
        data = s.DocumentDetailSerializer(document).data
        return cached_response(request, data, "document", document_id, document.text_fetched_at)


class DocumentPdfView(APIView):
    @extend_schema(
        operation_id="document_pdf_retrieve",
        summary="The document's PDF, relayed from fia.com (not stored)",
        responses={
            (200, "application/pdf"): OpenApiTypes.BINARY,
            404: ProblemSerializer,
            429: OpenApiResponse(ProblemSerializer, description="Retry after 10 s"),
            502: ProblemSerializer,
        },
        tags=TAG,
    )
    def get(self, request: Request, document_id: int) -> HttpResponse:
        document = get_object_or_404(FiaDocument, pk=document_id)
        try:
            data = relay.pdf_bytes(document)
        except ThrottleBusyError as exc:
            raise Throttled(wait=RETRY_AFTER_S) from exc
        except ProviderError as exc:
            raise UpstreamError from exc
        filename = document.url.rsplit("/", 1)[-1]
        return HttpResponse(
            data,
            content_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "public, max-age=86400",
            },
        )


class DecisionListView(APIView):
    @extend_schema(
        operation_id="stewards_decisions_list",
        summary="Stewards' decisions about cars, linked to drivers, sessions and laps",
        parameters=[s.DecisionQuerySerializer],
        responses={200: s.DecisionSerializer(many=True), **ERRORS},
        tags=TAG,
    )
    def get(self, request: Request) -> Response:
        query = _query(s.DecisionQuerySerializer, request)
        rows = list(
            selectors.decisions(
                season=query.get("season"),
                event_id=query.get("event"),
                driver_ref=query.get("driver"),
            )
        )
        data = s.DecisionSerializer(
            rows, many=True, context={"teams": selectors.team_colours(rows)}
        ).data
        return cached_response(request, data, "decisions", sorted(query.items()), *_stamp())
