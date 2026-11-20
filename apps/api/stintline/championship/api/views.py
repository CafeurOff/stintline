from __future__ import annotations

from typing import Any

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from stintline.championship import selectors
from stintline.championship.api.serializers import TitleSerializer
from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response


class SeasonTitleView(APIView):
    @extend_schema(
        operation_id="season_title_retrieve",
        summary="Title maths: who can still be champion, what the leader needs, when it was "
        "decided",
        responses={200: TitleSerializer, 404: ProblemSerializer},
        tags=["racing"],
    )
    def get(self, request: Request, year: int) -> Response:
        today = timezone.now().date()
        state = selectors.title_state(year, today)
        if state is None:
            raise NotFound("No championship for this season.")
        data: dict[str, Any] = TitleSerializer(selectors.as_payload(state)).data
        return cached_response(
            request, data, "title", year, today.isoformat(), selectors.data_stamp()
        )
