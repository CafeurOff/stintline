import datetime as dt
from io import StringIO
from typing import Any, ClassVar

import pytest
from django.core.cache import cache
from django.core.management import CommandError, call_command
from django.test import override_settings
from rest_framework.test import APIClient

from racedata.errors import UpstreamUnavailableError
from racedata.models import FiaCategory, FiaDocumentRef, StewardsDecisionRecord
from racedata.models import Penalty as PenaltyRecord
from racedata.providers.fia import FiaSource
from racedata.sources import build_fixture_sources
from stintline.paddock import refresh, relay, services, tasks, throttle
from stintline.paddock.models import FiaDocument, FiaEventListing, StewardsDecision
from stintline.racing.models import Event, SessionKind
from stintline.racing.tests.factories import CircuitFactory, EventFactory, SeasonFactory

pytestmark = pytest.mark.django_db

HUNGARY = "Hungarian Grand Prix"
NOW = dt.datetime(2026, 11, 13, 12, tzinfo=dt.UTC)


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    cache.clear()


def decision_for(car: int) -> StewardsDecision:
    return StewardsDecision.objects.select_related("driver", "session").get(
        car_number=car, document__title__icontains="Erratic" if car == 16 else ""
    )


# ----------------------------------------------------------------- import (seed)


def test_seed_lists_hungary_and_reads_its_decisions(seeded: None) -> None:
    hungary = Event.objects.get(season__year=2025, round=14)

    assert FiaDocument.objects.filter(event=hungary).count() == 45
    assert FiaEventListing.objects.get(event=hungary).fia_name == HUNGARY
    assert StewardsDecision.objects.filter(document__event=hungary).count() == 7
    classification = FiaDocument.objects.get(event=hungary, title="Final Race Classification")
    assert "NORRIS" in classification.text.upper()


def test_decision_is_linked_to_driver_session_and_lap(seeded: None) -> None:
    decision = StewardsDecision.objects.select_related("driver", "session").get(
        document__title__icontains="Erratic"
    )

    assert decision.driver is not None
    assert decision.driver.ref == "leclerc"
    assert decision.session is not None
    assert decision.session.kind == SessionKind.RACE
    assert decision.lap is not None
    assert 55 <= decision.lap <= 70
    assert (decision.time_penalty_s, decision.penalty_points) == (5, 1)
    assert decision.is_penalty


def test_decision_outside_a_race_has_no_lap(seeded: None) -> None:
    decision = StewardsDecision.objects.get(document__title__icontains="Parc Ferme")

    assert decision.session_label == "Qualifying"
    assert decision.lap is None
    assert decision.pit_lane_start


def test_no_further_action_is_not_a_penalty(seeded: None) -> None:
    decision = StewardsDecision.objects.get(document__title__icontains="unsafe release")

    assert not decision.is_penalty


def test_listing_twice_creates_no_duplicates(seeded: None) -> None:
    hungary = Event.objects.get(season__year=2025, round=14)
    sources = build_fixture_sources()
    try:
        assert sources.fia is not None
        report = services.list_event(sources.fia, 2025, hungary, HUNGARY, NOW)
    finally:
        sources.close()

    assert report.created == 0
    assert FiaDocument.objects.filter(event=hungary).count() == 45


# ----------------------------------------------------------------- pure helpers


@pytest.mark.parametrize(
    ("fia_name", "ours", "matches"),
    [
        ("Hungarian Grand Prix", "Hungarian Grand Prix", True),
        ("São Paulo Grand Prix", "Sao Paulo Grand Prix", True),
        ("Barcelona-Catalunya Grand Prix", "Barcelona Grand Prix", True),
        ("Bahrain Grand Prix", "Bahrain Grand Prix in Malaysia", True),
        ("Bahrain Tests Season 2025", "Bahrain Grand Prix", False),
        ("Monaco Grand Prix", "Belgian Grand Prix", False),
    ],
)
def test_match_event(fia_name: str, ours: str, matches: bool) -> None:
    event = EventFactory.create(season=SeasonFactory.create(year=2030), name=ours)

    found = services.match_event(2030, fia_name)

    assert (found == event) is matches


def test_match_event_by_the_circuit_city() -> None:
    season = SeasonFactory.create(year=2030)
    brazil = EventFactory.create(
        season=season,
        name="Brazilian Grand Prix",
        circuit=CircuitFactory.create(locality="São Paulo"),
    )
    EventFactory.create(season=season, name="Mexico City Grand Prix")

    assert services.match_event(2030, "São Paulo Grand Prix") == brazil


@pytest.mark.parametrize(
    ("label", "kind"),
    [
        ("Race", SessionKind.RACE),
        ("Sprint Qualifying", SessionKind.SPRINT_QUALIFYING),
        ("Sprint", SessionKind.SPRINT),
        ("Practice 2", SessionKind.PRACTICE_2),
        ("Qualifying", SessionKind.QUALIFYING),
        ("Parc Fermé", None),
    ],
)
def test_session_kind_from_label(label: str, kind: SessionKind | None) -> None:
    assert services.session_kind(label) == kind


def _record(**changes: Any) -> StewardsDecisionRecord:
    values: dict[str, Any] = {
        "car": 16,
        "driver_name": "Charles Leclerc",
        "competitor": "Ferrari",
        "incident_time": "16:26",
        "session": "Race",
        "fact": "f",
        "infringement": "i",
        "decision": "d",
        "reason": "r",
        "penalty": PenaltyRecord(),
        "issued_on": dt.date(2025, 8, 3),
        "issued_time": "18:08",
        **changes,
    }
    return StewardsDecisionRecord(**values)


def test_utc_offset_from_issue_and_publication() -> None:
    published = dt.datetime(2025, 8, 3, 16, 9, tzinfo=dt.UTC)

    assert services.utc_offset(_record(), published) == dt.timedelta(hours=2)
    assert services.utc_offset(_record(issued_time=None), published) is None


# ------------------------------------------------------------------- refresh


class FakeFia:
    """A FiaSource double: two events, one document each, PDFs from the fixtures."""

    seasons: ClassVar[list[int]] = [2025]

    def __init__(self) -> None:
        self.listed: list[str] = []
        real = build_fixture_sources()
        assert real.fia is not None
        self._real: FiaSource = real.fia
        self._sources = real

    def season_event_names(self, season: int) -> list[str]:
        return [HUNGARY, "Belgian Grand Prix", "Bahrain Tests Season 2025"]

    def event_documents(self, season: int, event_name: str) -> list[FiaDocumentRef]:
        self.listed.append(event_name)
        if event_name == HUNGARY:
            return self._real.event_documents(season, event_name)
        return [
            FiaDocumentRef(
                event_name=event_name,
                number=1,
                title="Event Notes - Pirelli Preview",
                category=FiaCategory.NOTES,
                published_at=dt.datetime(2025, 7, 24, 9, tzinfo=dt.UTC),
                url="https://www.fia.com/system/files/decision-document/belgium_notes.pdf",
            )
        ]

    def document_pdf(self, url: str) -> bytes:
        if "belgium" in url:
            raise UpstreamUnavailableError("fia", "down")
        try:
            return self._real.document_pdf(url)
        except LookupError as exc:  # not recorded: behaves like an outage
            raise UpstreamUnavailableError("fia", "not recorded") from exc

    def close(self) -> None:
        self._sources.close()


def test_due_events_lists_active_and_never_listed_events(seeded: None) -> None:
    fake = FakeFia()
    try:
        due = refresh.due_events(fake, 2025, dt.datetime(2025, 8, 5, tzinfo=dt.UTC))  # type: ignore[arg-type]
    finally:
        fake.close()

    names = [name for _, name in due]
    assert "Belgian Grand Prix" in names
    assert HUNGARY not in names  # listed by the seed, not stale


def test_refresh_lists_within_budget_and_stops_on_upstream_errors(seeded: None) -> None:
    fake = FakeFia()
    try:
        report = refresh.refresh(
            fake,  # type: ignore[arg-type]
            [2025],
            dt.datetime(2025, 8, 5, tzinfo=dt.UTC),
            event_pages=1,
            texts=40,
        )
    finally:
        fake.close()

    assert fake.listed == ["Belgian Grand Prix"]
    assert report.new_documents == 1
    assert report.errors == 1  # the Belgian PDF is down: the run stops, nothing crashes


def test_unreadable_pdf_is_marked_read_with_no_text(seeded: None) -> None:
    document = FiaDocument.objects.filter(category="decision").first()
    assert document is not None

    class Broken:
        def document_pdf(self, url: str) -> bytes:
            return b"not a pdf"

    stored = services.fetch_text(Broken(), document, NOW)  # type: ignore[arg-type]

    document.refresh_from_db()
    assert not stored
    assert document.text == ""
    assert document.text_fetched_at == NOW


def test_task_and_command_run_without_seasons(
    seeded: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(services, "pending_texts", lambda limit: [])
    with override_settings(FIA_SEASONS=[]):
        assert tasks.refresh_fia_documents() == {"events": 0, "texts": 0, "errors": 0}
        out = StringIO()
        call_command("ingest_fia", "--texts", "0", stdout=out)
    assert "0 events listed" in out.getvalue()
    with pytest.raises(CommandError):
        call_command("ingest_fia", "--season", "1999")


# ------------------------------------------------------------------- throttle


@override_settings(FIA_REQUEST_INTERVAL_S=10.0)
def test_throttle_gives_one_slot_per_interval() -> None:
    assert throttle.try_turn()
    assert not throttle.try_turn()
    waits: list[float] = []

    assert not throttle.wait_turn(sleep=waits.append)
    assert sum(waits) >= throttle.MAX_WAIT_S


@override_settings(FIA_REQUEST_INTERVAL_S=10.0)
def test_reader_goes_before_background_imports() -> None:
    cache.set(throttle.PRIORITY_KEY, 1)
    waits: list[float] = []

    assert not throttle.wait_turn(sleep=waits.append, max_wait_s=1.0)  # import steps aside
    assert throttle.wait_turn(sleep=waits.append, reader=True, max_wait_s=1.0)
    assert cache.get(throttle.PRIORITY_KEY) is None


# ------------------------------------------------------------------------ API


def test_documents_of_an_event_newest_first(seeded: None) -> None:
    hungary = Event.objects.get(season__year=2025, round=14)

    data = APIClient().get("/api/v1/documents", {"event": hungary.pk, "limit": 10}).json()

    assert data["count"] == 45
    dates = [d["published_at"] for d in data["results"]]
    assert dates == sorted(dates, reverse=True)
    assert data["results"][0]["event"]["name"] == HUNGARY


def test_search_finds_text_and_shows_a_snippet(seeded: None) -> None:
    data = APIClient().get("/api/v1/documents", {"q": "moved twice"}).json()

    assert data["count"] == 1
    hit = data["results"][0]
    assert "Erratic" in hit["title"]
    assert "moved twice" in hit["snippet"]
    assert hit["decision"]["penalty_points"] == 1


def test_filters_by_category_and_car(seeded: None) -> None:
    client = APIClient()

    decisions = client.get("/api/v1/documents", {"category": "infringement"}).json()
    car = client.get("/api/v1/documents", {"car": 22}).json()

    assert {d["category"] for d in decisions["results"]} == {"infringement"}
    assert car["count"] >= 2


def test_event_summaries_count_documents_and_penalties(seeded: None) -> None:
    data = APIClient().get("/api/v1/documents/events", {"season": 2025}).json()

    assert len(data) == 1
    assert data[0]["documents"] == 45
    assert data[0]["decisions"] == 7
    assert data[0]["penalties"] == 4


def test_document_detail_has_text_and_ruling(seeded: None) -> None:
    document = FiaDocument.objects.get(title__icontains="Erratic")

    data = APIClient().get(f"/api/v1/documents/{document.pk}").json()

    assert "Charles Leclerc" in data["text"]
    assert data["reason"]
    assert data["decision"]["driver"]["ref"] == "leclerc"


def test_decisions_by_driver_with_team_colour(seeded: None) -> None:
    data = APIClient().get("/api/v1/stewards/decisions", {"driver": "leclerc"}).json()

    assert len(data) == 1
    assert data[0]["lap"] is not None
    assert data[0]["team"]["ref"] == "ferrari"
    assert data[0]["event"]["round"] == 14


def test_pdf_is_relayed_then_served_from_cache(seeded: None) -> None:
    document = FiaDocument.objects.get(title__icontains="Erratic")
    client = APIClient()

    first = client.get(f"/api/v1/documents/{document.pk}/pdf")
    with override_settings(FIA_REQUEST_INTERVAL_S=10.0):
        throttle.try_turn()  # the slot is now busy: only the cache can answer
        second = client.get(f"/api/v1/documents/{document.pk}/pdf")

    assert first.status_code == 200
    assert first["Content-Type"] == "application/pdf"
    assert second.status_code == 200
    assert b"".join(second).startswith(b"%PDF")


@override_settings(FIA_REQUEST_INTERVAL_S=10.0)
def test_pdf_relay_says_when_to_retry(seeded: None, monkeypatch: pytest.MonkeyPatch) -> None:
    document = FiaDocument.objects.get(title__icontains="Erratic")
    throttle.try_turn()
    monkeypatch.setattr("time.sleep", lambda _: None)

    response = APIClient().get(f"/api/v1/documents/{document.pk}/pdf")

    assert response.status_code == 429
    assert response["Retry-After"] == "10"


def test_pdf_relay_maps_upstream_errors(seeded: None, monkeypatch: pytest.MonkeyPatch) -> None:
    document = FiaDocument.objects.get(title__icontains="Erratic")

    def down(_: FiaDocument) -> bytes:
        raise UpstreamUnavailableError("fia", "down")

    monkeypatch.setattr(relay, "pdf_bytes", down)

    response = APIClient().get(f"/api/v1/documents/{document.pk}/pdf")

    assert response.status_code == 502


def test_document_queries_are_validated(db: None) -> None:
    client = APIClient()

    assert client.get("/api/v1/documents", {"category": "gossip"}).status_code == 400
    assert client.get("/api/v1/documents/events").status_code == 400
    assert client.get("/api/v1/documents/999").status_code == 404
