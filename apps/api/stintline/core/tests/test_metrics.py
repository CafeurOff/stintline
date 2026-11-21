import datetime as dt

import pytest
from django.test import Client
from django.utils import timezone

from stintline.racing.models import SessionKind
from stintline.racing.tests.factories import SessionFactory


def _value(body: str, name: str) -> float:
    for line in body.splitlines():
        if line.startswith(f"{name} "):
            return float(line.split()[1])
    raise AssertionError(f"{name} missing from /metrics")


@pytest.mark.django_db
def test_metrics_reports_data_coverage_to_loopback() -> None:
    SessionFactory(ingested_at=dt.datetime(2025, 6, 1, 18, tzinfo=dt.UTC))
    SessionFactory(kind=SessionKind.QUALIFYING)

    response = Client(REMOTE_ADDR="127.0.0.1").get("/metrics")

    assert response.status_code == 200
    body = response.content.decode()
    assert _value(body, "stintline_sessions") == 2
    assert _value(body, "stintline_sessions_ingested") == 1
    assert _value(body, "stintline_last_ingest_timestamp_seconds") == pytest.approx(
        dt.datetime(2025, 6, 1, 18, tzinfo=dt.UTC).timestamp()
    )
    assert "django_http_requests_total_by_method_total" in body


@pytest.mark.django_db
def test_metrics_counts_recent_races_not_imported_as_overdue() -> None:
    ended = timezone.now() - dt.timedelta(hours=8)
    SessionFactory(starts_at=ended - dt.timedelta(hours=2), ends_at=ended)
    SessionFactory(ends_at=timezone.now() - dt.timedelta(hours=1))  # still within the grace
    SessionFactory(ends_at=timezone.now() - dt.timedelta(days=60))  # history, not overdue

    body = Client(REMOTE_ADDR="127.0.0.1").get("/metrics").content.decode()

    assert _value(body, "stintline_races_overdue") == 1


@pytest.mark.django_db
def test_metrics_is_hidden_from_other_addresses() -> None:
    response = Client(REMOTE_ADDR="203.0.113.7").get("/metrics")

    assert response.status_code == 404
