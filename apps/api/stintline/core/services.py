"""Health checks for the API and its backing services."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import structlog
from django.db import DatabaseError, connection

log = structlog.get_logger(__name__)

ComponentStatus = Literal["ok", "unavailable"]


@dataclass(frozen=True, slots=True)
class HealthReport:
    status: ComponentStatus
    version: str
    database: ComponentStatus


def check_database() -> ComponentStatus:
    """Run a trivial query. Returns ``"unavailable"`` instead of raising."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except DatabaseError:
        log.warning("health_database_unavailable", exc_info=True)
        return "unavailable"
    return "ok"


def build_health_report(version: str) -> HealthReport:
    database = check_database()
    overall: ComponentStatus = "ok" if database == "ok" else "unavailable"
    return HealthReport(status=overall, version=version, database=database)
