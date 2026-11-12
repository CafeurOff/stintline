"""Provider-neutral DTOs. Every datetime is timezone-aware UTC and every duration is in
seconds. Nothing outside ``racedata`` sees raw upstream payloads.
"""

from __future__ import annotations

from datetime import UTC, date, datetime
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_validator


class _DTO(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")


class SessionKind(StrEnum):
    PRACTICE_1 = "FP1"
    PRACTICE_2 = "FP2"
    PRACTICE_3 = "FP3"
    SPRINT_QUALIFYING = "SQ"
    SPRINT = "SPRINT"
    QUALIFYING = "Q"
    RACE = "R"


class EventFormat(StrEnum):
    CONVENTIONAL = "conventional"
    SPRINT = "sprint"


class Compound(StrEnum):
    SOFT = "SOFT"
    MEDIUM = "MEDIUM"
    HARD = "HARD"
    INTERMEDIATE = "INTERMEDIATE"
    WET = "WET"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def parse(cls, value: str | None) -> Compound:
        """Map upstream labels (``None``, ``"TEST_UNKNOWN"``, lowercase…) to a compound."""
        if not value:
            return cls.UNKNOWN
        try:
            return cls(value.strip().upper())
        except ValueError:
            return cls.UNKNOWN


class TrackStatusKind(StrEnum):
    SAFETY_CAR = "SC"
    VIRTUAL_SAFETY_CAR = "VSC"
    RED_FLAG = "RED"


def _require_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("datetime must be timezone-aware")
    return value


# Schedule and classification models, sourced from Jolpica.


class CircuitInfo(_DTO):
    circuit_id: str
    name: str
    locality: str
    country: str
    latitude: float | None = None
    longitude: float | None = None
    url: str | None = None


class ScheduledSession(_DTO):
    kind: SessionKind
    starts_at: datetime | None

    @field_validator("starts_at")
    @classmethod
    def _utc(cls, v: datetime | None) -> datetime | None:
        return None if v is None else _require_utc(v)


class EventInfo(_DTO):
    season: int
    round: int
    name: str
    race_date: date
    format: EventFormat
    circuit: CircuitInfo
    sessions: tuple[ScheduledSession, ...]


class ResultRecord(_DTO):
    """Classification row. ``car_number`` is the number raced that weekend, which is what
    timing data uses. ``permanent_number`` may reflect a later season."""

    driver_id: str
    code: str | None
    given_name: str
    family_name: str
    car_number: int
    constructor_id: str
    constructor_name: str
    grid: int | None
    position: int | None
    position_text: str
    status: str
    points: float
    laps_completed: int
    nationality: str | None = None
    date_of_birth: date | None = None
    permanent_number: int | None = None
    driver_url: str | None = None
    constructor_nationality: str | None = None
    constructor_url: str | None = None
    race_time_s: float | None = None
    """Winner's total time, or this car's own total when classified on the lead lap."""
    fastest_lap_rank: int | None = None
    fastest_lap_s: float | None = None


class JolpicaPitStop(_DTO):
    driver_id: str
    stop_number: int
    lap_number: int
    duration_s: float | None
    local_time: str
    """Circuit-local wall time as published (``HH:MM:SS``). Not converted, not used for joins."""


# Timing models, sourced from OpenF1.


class TimingSession(_DTO):
    session_key: int
    meeting_key: int
    kind: SessionKind
    name: str
    starts_at: datetime
    ends_at: datetime | None
    circuit_key: int | None
    circuit_short_name: str | None
    country_name: str | None
    year: int

    @field_validator("starts_at")
    @classmethod
    def _utc(cls, v: datetime) -> datetime:
        return _require_utc(v)


class DriverEntry(_DTO):
    driver_number: int
    acronym: str | None
    first_name: str | None
    last_name: str | None
    team_name: str | None
    team_colour: str | None
    """Hex RGB without ``#`` (e.g. ``"4781D7"``), when published."""
    media_id: str | None = None
    """Official media identifier of the driver (e.g. ``"lannor01"``), parsed from the
    headshot URL. A reference only: images are never downloaded (ADR 0006)."""


class LapRecord(_DTO):
    driver_number: int
    lap_number: int
    lap_time_s: float | None
    sector_1_s: float | None
    sector_2_s: float | None
    sector_3_s: float | None
    is_pit_out_lap: bool
    started_at: datetime | None
    speed_trap_kph: int | None


class StintRecord(_DTO):
    driver_number: int
    stint_number: int
    compound: Compound
    lap_start: int | None
    lap_end: int | None
    tyre_age_at_start: int | None


class PitRecord(_DTO):
    driver_number: int
    lap_number: int
    occurred_at: datetime
    pit_lane_duration_s: float | None
    stationary_duration_s: float | None


class RaceControlRecord(_DTO):
    occurred_at: datetime
    lap_number: int | None
    category: str
    flag: str | None
    scope: str | None
    sector: int | None
    driver_number: int | None
    message: str


class WeatherRecord(_DTO):
    sampled_at: datetime
    air_temperature_c: float | None
    track_temperature_c: float | None
    humidity_pct: float | None
    pressure_mbar: float | None
    rainfall: bool
    wind_speed_ms: float | None
    wind_direction_deg: int | None


class PositionSample(_DTO):
    """Car position on the circuit plane (OpenF1 ``location``, about 3.7 Hz). Units are
    the feed's own (roughly decimetres) and only meaningful relative to each other."""

    at: datetime
    x: float
    y: float


class CarSample(_DTO):
    """Car telemetry (OpenF1 ``car_data``, about 3.7 Hz).

    ``brake`` is on or off: the feed only sends 0 or 100. ``throttle`` is a percentage.
    """

    at: datetime
    speed_kph: int
    throttle_pct: int
    brake: bool
    gear: int
    rpm: int
    drs: int


class TrackStatusPeriod(_DTO):
    """A neutralised period derived from race control messages."""

    status: TrackStatusKind
    started_at: datetime
    ended_at: datetime | None
    lap_start: int | None
    lap_end: int | None


class DriverInfo(_DTO):
    """Driver biography (Jolpica ``drivers``), for profiles. Covers 1950 to today."""

    driver_id: str
    code: str | None
    permanent_number: int | None
    given_name: str
    family_name: str
    date_of_birth: date | None
    nationality: str | None
    url: str | None


class ConstructorInfo(_DTO):
    constructor_id: str
    name: str
    nationality: str | None
    url: str | None


class QualifyingRecord(_DTO):
    driver_id: str
    code: str | None
    given_name: str
    family_name: str
    car_number: int
    constructor_id: str
    constructor_name: str
    position: int | None
    q1_s: float | None
    q2_s: float | None
    q3_s: float | None


class StandingRecord(_DTO):
    """One line of a championship table after ``round``. ``competitor_id`` is a Jolpica
    driverId for the drivers' table, a constructorId for the constructors' table."""

    season: int
    round: int
    competitor_id: str
    position: int | None
    position_text: str
    points: float
    wins: int


class TeamRadioRecord(_DTO):
    """A team radio message. ``url`` points at the official recording (a reference,
    never downloaded or re-hosted)."""

    driver_number: int
    recorded_at: datetime
    url: str


class WikiPortrait(_DTO):
    """Lead image of a Wikipedia article, freely licensed (Wikimedia Commons or local).

    ``image_url`` is a thumbnail on upload.wikimedia.org: a reference, never downloaded.
    ``artist`` and ``license`` are what the licence requires us to show next to it.
    """

    title: str
    image_url: str
    file_page_url: str
    artist: str
    license: str
    license_url: str


class Headline(_DTO):
    """One item of a news feed: a title and a link to the publisher's article.

    The article text and summary are never kept (ADR 0012). The publisher's picture is kept
    as a URL reference only, never downloaded (ADR 0015).
    """

    source: str
    """``FeedConfig.key`` of the feed."""
    language: str
    title: str
    url: str
    published_at: datetime
    image_url: str | None = None
    """HTTPS URL of the image the publisher attaches to the item, when the feed has one."""

    @field_validator("published_at")
    @classmethod
    def _utc(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("published_at must be timezone-aware")
        return value.astimezone(UTC)
