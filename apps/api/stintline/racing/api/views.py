from __future__ import annotations

from typing import Any

from django.db.models import Max, QuerySet
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import APIException, NotFound
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from racedata import ProviderError
from stintline.core.api.serializers import ProblemSerializer
from stintline.core.http import cached_response
from stintline.racing import careers, hub, portraits, selectors
from stintline.racing.api.serializers.calendar import EventSerializer
from stintline.racing.api.serializers.common import SeasonSerializer
from stintline.racing.api.serializers.drivers import (
    DriverCareerSerializer,
    DriverFormSerializer,
    DriverListItemSerializer,
    DriverQuerySerializer,
    DriverResultSerializer,
)
from stintline.racing.api.serializers.home import HomeSerializer
from stintline.racing.api.serializers.sessions import (
    EntryStintsSerializer,
    SectorsSerializer,
    SessionDetailSerializer,
    TeamRadioSerializer,
    TimelineSerializer,
    TrackSerializer,
)
from stintline.racing.api.serializers.standings import (
    ProgressionSerializer,
    RoundQuerySerializer,
    StandingsSerializer,
)
from stintline.racing.api.serializers.teams import (
    TeamCareerSerializer,
    TeamListSerializer,
    TeamQuerySerializer,
)
from stintline.racing.geometry import normalise_outline
from stintline.racing.models import (
    Driver,
    DriverPortrait,
    Event,
    Season,
    Session,
    SessionEntry,
    Team,
)
from stintline.racing.timeline import session_timeline as timeline_of


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


def _season_param(request: Request) -> int | None:
    """The validated ``season`` query parameter (the list view already rejected bad ones)."""
    raw = request.query_params.get("season", "")
    return int(raw) if raw.isdigit() else None


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


class SessionTimelineView(APIView):
    @extend_schema(
        operation_id="session_timeline_retrieve",
        summary="Every lap on the session clock, with tyres and qualifying segments",
        description=(
            "Any imported session (practice, qualifying, sprint and race): the data of the "
            "session replay (ADR 0028). 404 when the session has no timed lap."
        ),
        responses={200: TimelineSerializer, 404: ProblemSerializer},
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        session = get_object_or_404(Session, pk=session_id)
        timeline = timeline_of(session)
        if timeline is None:
            raise NotFound("This session has no lap timing.")
        data = TimelineSerializer(timeline).data
        return cached_response(request, data, "timeline", session_id, session.ingested_at)


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

    serializer_class = DriverListItemSerializer

    def get_queryset(self) -> QuerySet[Driver]:
        params = DriverQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        season = params.validated_data.get("season")
        return hub.with_latest_team(
            careers.search_drivers(params.validated_data.get("search"), season), season
        )

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        season = _season_param(self.request)
        if season is not None:
            context["season_drivers"] = hub.season_drivers(season)
        return context

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


class DriverFormView(APIView):
    @extend_schema(
        operation_id="driver_form_retrieve",
        summary="Last five Grands Prix: finish, grid and fuel-corrected pace gap to the teammate",
        responses={200: DriverFormSerializer, 404: ProblemSerializer},
        tags=["drivers"],
    )
    def get(self, request: Request, ref: str) -> Response:
        driver = get_object_or_404(Driver, ref=ref)
        data = DriverFormSerializer(
            {"min_clean_laps": careers.FORM_MIN_CLEAN_LAPS, "races": careers.driver_form(driver)}
        ).data
        # Analysis figures are rebuilt after imports: their date is part of the version.
        built = Session.objects.aggregate(last=Max("stats__built_at"))["last"]
        return cached_response(request, data, "driver-form", ref, _data_stamp(), built)


class DriverPortraitView(APIView):
    @extend_schema(
        operation_id="driver_portrait_retrieve",
        summary="The driver's Wikipedia portrait, relayed from Wikimedia (ADR 0024, not stored)",
        responses={
            (200, "image/*"): OpenApiTypes.BINARY,
            404: ProblemSerializer,
            502: ProblemSerializer,
        },
        tags=["drivers"],
    )
    def get(self, request: Request, ref: str) -> HttpResponse:
        portrait = get_object_or_404(
            DriverPortrait.objects.select_related("driver"), driver__ref=ref
        )
        try:
            image = portraits.portrait_image(portrait)
        except ProviderError as exc:
            raise PortraitUnavailableError from exc
        # The URL carries a version of the image (`?v=`): browsers may keep it a week.
        return HttpResponse(
            image.content,
            content_type=image.content_type,
            headers={"Cache-Control": f"public, max-age={portraits.CACHE_SECONDS}"},
        )


class PortraitUnavailableError(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Wikimedia did not return the portrait."
    default_code = "upstream_unavailable"


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
        summary="Team radio messages: official recordings, lap and transcript",
        responses=TeamRadioSerializer(many=True),
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        stamp = _session_or_404(session_id).ingested_at
        rows = selectors.session_radio(session_id)
        data = TeamRadioSerializer(rows, many=True).data
        heard = selectors.radio_stamp(session_id)
        # The version changes with the response shape (2: lap_fraction).
        return cached_response(request, data, "radio", 2, session_id, stamp, heard)


class EventDetailView(APIView):
    @extend_schema(
        operation_id="event_retrieve",
        summary="A Grand Prix weekend with its sessions and race winner",
        responses={200: EventSerializer, 404: ProblemSerializer},
        tags=["racing"],
    )
    def get(self, request: Request, event_id: int) -> Response:
        try:
            event = hub.event_detail(event_id)
        except Event.DoesNotExist as exc:
            raise NotFound("No such event.") from exc
        return cached_response(
            request, EventSerializer(event).data, "event", event_id, _data_stamp()
        )


class TeamListView(generics.ListAPIView[Team]):
    """Every constructor since 1950, searchable by name, optionally limited to a season."""

    serializer_class = TeamListSerializer

    def get_queryset(self) -> QuerySet[Team]:
        params = TeamQuerySerializer(data=self.request.query_params)
        params.is_valid(raise_exception=True)
        return hub.search_teams(
            params.validated_data.get("search"), params.validated_data.get("season")
        )

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        season = _season_param(self.request)
        if season is not None:
            context["season_teams"] = hub.season_teams(season)
        return context

    @extend_schema(
        operation_id="teams_list",
        parameters=[
            OpenApiParameter("search", str, required=False),
            OpenApiParameter("season", int, required=False),
        ],
        tags=["teams"],
    )
    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return super().get(request, *args, **kwargs)


class TeamCareerView(APIView):
    @extend_schema(
        operation_id="team_retrieve",
        summary="Constructor record: totals and season-by-season results",
        responses={200: TeamCareerSerializer, 404: ProblemSerializer},
        tags=["teams"],
    )
    def get(self, request: Request, ref: str) -> Response:
        team = get_object_or_404(Team, ref=ref)
        data = TeamCareerSerializer(hub.team_career(team)).data
        return cached_response(request, data, "team", ref, _data_stamp())


HOME_MAX_AGE_S = 300
"""The home page moves on when a race finishes: browsers revalidate it every few minutes."""


class HomeView(APIView):
    @extend_schema(
        operation_id="home_retrieve",
        summary="Next Grand Prix, last race podium and championship leaders",
        responses=HomeSerializer,
        tags=["racing"],
    )
    def get(self, request: Request) -> Response:
        home = hub.home(timezone.now())
        data = HomeSerializer(home).data
        # Changes when a race finishes (next and last race move on), not only at midnight.
        next_event = home["next_event"].pk if home["next_event"] else None
        last_race = home["last_race"]["session_id"] if home["last_race"] else None
        return cached_response(
            request, data, "home", next_event, last_race, _data_stamp(), max_age=HOME_MAX_AGE_S
        )


class SeasonProgressionView(APIView):
    @extend_schema(
        operation_id="season_progression_retrieve",
        summary="Championship points of every driver and team after each round",
        responses={200: ProgressionSerializer, 404: ProblemSerializer},
        tags=["racing"],
    )
    def get(self, request: Request, year: int) -> Response:
        data = hub.progression(year)
        if data is None:
            raise NotFound("No standings for this season.")
        return cached_response(
            request, ProgressionSerializer(data).data, "progression", year, _data_stamp()
        )


class SessionSectorsView(APIView):
    @extend_schema(
        operation_id="session_sectors_list",
        summary="Best lap, best sectors, ideal lap and top speed of every car",
        responses=SectorsSerializer(many=True),
        tags=["racing"],
    )
    def get(self, request: Request, session_id: int) -> Response:
        stamp = _session_or_404(session_id).ingested_at
        data = SectorsSerializer(selectors.session_sectors(session_id), many=True).data
        return cached_response(request, data, "sectors", session_id, stamp)
