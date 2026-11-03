"""Results, qualifying, standings, biographies and team radio from recorded fixtures."""

from datetime import UTC, datetime, timedelta
from io import StringIO
from unittest import mock

import pytest
from django.core.management import call_command

from racedata.errors import UpstreamUnavailableError
from racedata.sources import Sources, build_fixture_sources
from stintline.ingestion import history, services, tasks
from stintline.racing.models import (
    Driver,
    Event,
    Season,
    Session,
    SessionEntry,
    SessionKind,
    Standing,
    TeamRadio,
)
from stintline.racing.tests.factories import SessionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def sources() -> Sources:
    return build_fixture_sources()


def test_1950_season_builds_calendar_results_and_final_standings(sources: Sources) -> None:
    report = history.ingest_season_results(1950, sources)

    assert Event.objects.filter(season__year=1950).count() == 7
    silverstone = SessionEntry.objects.get(
        session__event__season__year=1950, session__event__round=1, finish_position=1
    )
    assert silverstone.driver.ref == "farina"
    assert silverstone.race_time_s == pytest.approx(8003.6)
    final = Standing.objects.filter(season__year=1950, driver__isnull=False)
    assert final.get(position=1).driver.ref == "farina"  # type: ignore[union-attr]
    assert set(final.values_list("round", flat=True)) == {7}
    assert Season.objects.get(year=1950).results_ingested_at is not None
    assert any("shared or duplicate" in s for s in report.skipped)


def test_reference_import_fills_biographies(sources: Sources) -> None:
    history.ingest_reference(sources)

    fangio = Driver.objects.get(ref="fangio")
    assert fangio.nationality == "Argentine"
    assert fangio.date_of_birth is not None
    assert fangio.wikipedia_url.startswith("http")


def test_2025_results_complete_timed_entries_without_erasing_timing_columns(
    seeded: None,
) -> None:
    norris = SessionEntry.objects.get(
        session__event__round=14, session__kind=SessionKind.RACE, driver__ref="norris"
    )
    assert norris.team_colour  # from OpenF1, kept
    assert norris.fastest_lap_rank is not None
    quali = SessionEntry.objects.get(
        session__event__round=14, session__kind=SessionKind.QUALIFYING, driver__ref="leclerc"
    )
    assert quali.finish_position == 1
    assert quali.q3_s is not None
    rounds = set(Standing.objects.filter(season__year=2025).values_list("round", flat=True))
    assert rounds == set(range(1, 25))  # championship after every round


def test_season_results_need_a_history_source(sources: Sources) -> None:
    bare = Sources(sources.schedule, sources.results, sources.timing, ())

    with pytest.raises(history.HistoryUnavailableError):
        history.ingest_season_results(2025, bare)


def test_team_radio_references_are_stored_per_session(seeded: None) -> None:
    radio = TeamRadio.objects.filter(session__event__round=14)

    assert radio.count() == 37
    assert all(r.url.startswith("https://livetiming.formula1.com/") for r in radio)


def test_ingest_history_command_resumes_and_skips_finished_seasons() -> None:
    out = StringIO()
    call_command("ingest_history", "--from", "1950", "--to", "1950", stdout=out)
    call_command("ingest_history", "--from", "1950", "--to", "1950", "--skip-reference", stdout=out)

    assert "1950: already imported, skipped" in out.getvalue()
    assert Driver.objects.filter(ref="fangio").exists()


def test_ingest_history_command_stops_cleanly_on_upstream_failure() -> None:
    err = StringIO()
    with (
        mock.patch.object(
            history,
            "ingest_season_results",
            side_effect=UpstreamUnavailableError("jolpica", "down"),
        ),
        pytest.raises(SystemExit),
    ):
        call_command(
            "ingest_history", "--from", "1950", "--to", "1950", "--skip-reference", stderr=err
        )

    assert "run again to resume" in err.getvalue()


def test_refresh_recent_queues_finished_sessions_once_per_window() -> None:
    now = datetime(2025, 8, 3, 18, tzinfo=UTC)
    due = SessionFactory.create(
        kind=SessionKind.RACE, openf1_session_key=1, ends_at=now - timedelta(hours=2)
    )
    SessionFactory.create(  # too fresh: data not published yet
        kind=SessionKind.RACE, openf1_session_key=2, ends_at=now - timedelta(minutes=10)
    )
    SessionFactory.create(  # imported recently: wait
        kind=SessionKind.RACE,
        openf1_session_key=3,
        ends_at=now - timedelta(hours=5),
        ingested_at=now - timedelta(hours=1),
    )
    with (
        mock.patch.object(tasks.ingest_session, "delay") as session_delay,
        mock.patch.object(tasks.ingest_season_results, "delay") as results_delay,
    ):
        queued = tasks.refresh_recent(now.isoformat())

    assert queued == [due.pk]
    session_delay.assert_called_once_with(due.pk)
    results_delay.assert_called_once_with(due.event.season.year)


def test_season_task_queues_results_import() -> None:
    with (
        mock.patch.object(services, "ingest_calendar", return_value=[]),
        mock.patch.object(tasks.ingest_season_results, "delay") as results_delay,
    ):
        tasks.ingest_season(2025)

    results_delay.assert_called_once_with(2025)


def test_results_and_calendar_tasks_use_the_configured_sources() -> None:
    with (
        mock.patch.object(tasks, "open_sources", side_effect=FixtureSources),
        mock.patch.object(services, "ingest_calendar", return_value=[1, 2]) as calendar,
    ):
        assert tasks.ingest_season_results(1950)["r_results"] > 0
        assert tasks.refresh_calendar() == 2
    calendar.assert_called_once()
    assert Session.objects.filter(event__season__year=1950).exists()


class FixtureSources:
    def __enter__(self) -> Sources:
        self.sources = build_fixture_sources()
        return self.sources

    def __exit__(self, *exc: object) -> None:
        self.sources.close()
