from __future__ import annotations

from typing import Any

from django.core.cache import cache
from django.db.models import Max
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import etag_for
from stintline.news import reports
from stintline.news.api.serializers import (
    HeadlineQuerySerializer,
    HeadlineSerializer,
    RaceReportSerializer,
    ReportQuerySerializer,
)
from stintline.news.models import Headline
from stintline.racing.models import Season, Session

HEADLINES_MAX_AGE_S = 300
REPORT_CACHE_S = 24 * 60 * 60
REPORT_FORMAT = 2
"""Bumped whenever the report fields change, so cached reports are rebuilt."""


def _data_stamp() -> str:
    seasons = Season.objects.aggregate(last=Max("results_ingested_at"))["last"]
    sessions = Session.objects.aggregate(last=Max("ingested_at"))["last"]
    return f"{seasons}-{sessions}"


def _report(session: Session, stamp: str) -> dict[str, Any] | None:
    """Serialized report, cached until results or timing are imported again."""
    key = f"news:report:{session.pk}:{etag_for(stamp).strip('"')}"
    data: dict[str, Any] | None = cache.get(key)
    if data is None:
        facts = reports.build(session)
        if facts is None:
            return None
        data = dict(RaceReportSerializer(facts).data)
        cache.set(key, data, REPORT_CACHE_S)
    return data


class HeadlineListView(APIView):
    @extend_schema(
        operation_id="news_headlines_list",
        summary="Latest headlines from public news feeds (title and link only)",
        parameters=[HeadlineQuerySerializer],
        responses=HeadlineSerializer(many=True),
        tags=["news"],
    )
    def get(self, request: Request) -> Response:
        query = HeadlineQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        rows = Headline.objects.all()
        if lang := query.validated_data.get("lang"):
            rows = rows.filter(language=lang)
        data = HeadlineSerializer(rows[: query.validated_data["limit"]], many=True).data
        return Response(data, headers={"Cache-Control": f"public, max-age={HEADLINES_MAX_AGE_S}"})


class ReportListView(APIView):
    @extend_schema(
        operation_id="news_reports_list",
        summary="Reports of the latest races and sprints, written from our data",
        parameters=[ReportQuerySerializer],
        responses=RaceReportSerializer(many=True),
        tags=["news"],
    )
    def get(self, request: Request) -> Response:
        query = ReportQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        stamp = _data_stamp()
        sessions = reports.reported_sessions()[: query.validated_data["limit"]]
        data = [r for s in sessions if (r := _report(s, stamp)) is not None]
        return Response(data)


class ReportDetailView(APIView):
    @extend_schema(
        operation_id="news_report_retrieve",
        summary="Report of one race or sprint",
        responses={200: RaceReportSerializer, 404: ProblemSerializer},
        tags=["news"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        session = reports.reported_sessions().filter(pk=session_id).first()
        data = _report(session, _data_stamp()) if session is not None else None
        if data is None:
            raise NotFound("No report for this session.")
        return Response(data)
