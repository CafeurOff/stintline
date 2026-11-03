"""Race data model.

Every ingested table has a natural-key ``UniqueConstraint`` so imports are idempotent
upserts. Provider identifiers are stored as columns, never used as primary keys. All
datetimes are aware UTC and every duration is in seconds.
"""

from __future__ import annotations

from django.db import models
from django.db.models import F, Q


class SessionKind(models.TextChoices):
    PRACTICE_1 = "FP1", "Practice 1"
    PRACTICE_2 = "FP2", "Practice 2"
    PRACTICE_3 = "FP3", "Practice 3"
    SPRINT_QUALIFYING = "SQ", "Sprint Qualifying"
    SPRINT = "SPRINT", "Sprint"
    QUALIFYING = "Q", "Qualifying"
    RACE = "R", "Race"


RACE_KINDS = frozenset({SessionKind.RACE, SessionKind.SPRINT})
"""Sessions whose timing data is ingested (strategy only concerns races)."""


class EventFormat(models.TextChoices):
    CONVENTIONAL = "conventional", "Conventional"
    SPRINT = "sprint", "Sprint weekend"


class Compound(models.TextChoices):
    SOFT = "SOFT", "Soft"
    MEDIUM = "MEDIUM", "Medium"
    HARD = "HARD", "Hard"
    INTERMEDIATE = "INTERMEDIATE", "Intermediate"
    WET = "WET", "Wet"
    UNKNOWN = "UNKNOWN", "Unknown"


class TrackStatusKind(models.TextChoices):
    SAFETY_CAR = "SC", "Safety Car"
    VIRTUAL_SAFETY_CAR = "VSC", "Virtual Safety Car"
    RED_FLAG = "RED", "Red flag"


class Season(models.Model):
    year = models.PositiveSmallIntegerField(unique=True)
    results_ingested_at = models.DateTimeField(
        null=True, blank=True, help_text="Last full import of results, qualifying and standings"
    )

    class Meta:
        ordering = ["-year"]

    def __str__(self) -> str:
        return str(self.year)


class Circuit(models.Model):
    ref = models.SlugField(max_length=64, unique=True, help_text="Jolpica circuitId")
    name = models.CharField(max_length=128)
    locality = models.CharField(max_length=128)
    country = models.CharField(max_length=64)
    openf1_circuit_key = models.PositiveIntegerField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    wikipedia_url = models.URLField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Event(models.Model):
    """A Grand Prix weekend."""

    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="events")
    round = models.PositiveSmallIntegerField()
    name = models.CharField(max_length=128)
    circuit = models.ForeignKey(Circuit, on_delete=models.PROTECT, related_name="events")
    race_date = models.DateField()
    format = models.CharField(max_length=16, choices=EventFormat.choices)
    openf1_meeting_key = models.PositiveIntegerField(null=True, blank=True, unique=True)

    class Meta:
        ordering = ["season__year", "round"]
        constraints = [
            models.UniqueConstraint(fields=["season", "round"], name="event_unique_season_round"),
        ]

    def __str__(self) -> str:
        return f"{self.season.year} R{self.round} {self.name}"


class Session(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="sessions")
    kind = models.CharField(max_length=8, choices=SessionKind.choices)
    scheduled_start = models.DateTimeField(null=True, blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    openf1_session_key = models.PositiveIntegerField(null=True, blank=True, unique=True)
    ingested_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["event__season__year", "event__round", "scheduled_start"]
        constraints = [
            models.UniqueConstraint(fields=["event", "kind"], name="session_unique_event_kind"),
        ]

    def __str__(self) -> str:
        return f"{self.event} {self.kind}"


class Team(models.Model):
    ref = models.SlugField(max_length=64, unique=True, help_text="Jolpica constructorId")
    name = models.CharField(max_length=128)
    nationality = models.CharField(max_length=64, blank=True)
    wikipedia_url = models.URLField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Driver(models.Model):
    ref = models.SlugField(max_length=64, unique=True, help_text="Jolpica driverId")
    code = models.CharField(max_length=3, blank=True)
    given_name = models.CharField(max_length=64)
    family_name = models.CharField(max_length=64)
    permanent_number = models.PositiveSmallIntegerField(null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=64, blank=True)
    wikipedia_url = models.URLField(blank=True)

    class Meta:
        ordering = ["family_name", "given_name"]

    def __str__(self) -> str:
        return f"{self.given_name} {self.family_name}"


class SessionEntry(models.Model):
    """A driver taking part in a session for a team, with the car number raced."""

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="entries")
    driver = models.ForeignKey(Driver, on_delete=models.PROTECT, related_name="entries")
    team = models.ForeignKey(Team, on_delete=models.PROTECT, related_name="entries")
    car_number = models.PositiveSmallIntegerField()
    team_colour = models.CharField(max_length=6, blank=True, help_text="Hex RGB without #")
    team_display_name = models.CharField(
        max_length=64, blank=True, help_text="Team name as shown in timing (e.g. Red Bull Racing)"
    )
    media_id = models.CharField(
        max_length=16, blank=True, help_text="Official driver media id, a reference only (ADR 0006)"
    )
    grid_position = models.PositiveSmallIntegerField(null=True, blank=True)
    finish_position = models.PositiveSmallIntegerField(null=True, blank=True)
    classification = models.CharField(max_length=8, blank=True, help_text="positionText")
    status = models.CharField(max_length=64, blank=True)
    points = models.FloatField(default=0.0)
    laps_completed = models.PositiveSmallIntegerField(default=0)
    race_time_s = models.FloatField(
        null=True, blank=True, help_text="Total race time when classified on the lead lap"
    )
    fastest_lap_rank = models.PositiveSmallIntegerField(null=True, blank=True)
    fastest_lap_s = models.FloatField(null=True, blank=True)
    q1_s = models.FloatField(null=True, blank=True, help_text="Qualifying sessions only")
    q2_s = models.FloatField(null=True, blank=True)
    q3_s = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["session", "finish_position", "car_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "driver"], name="entry_unique_session_driver"
            ),
            models.UniqueConstraint(
                fields=["session", "car_number"], name="entry_unique_session_car"
            ),
        ]
        verbose_name_plural = "session entries"

    def __str__(self) -> str:
        return f"#{self.car_number} {self.driver} ({self.session})"


class Lap(models.Model):
    entry = models.ForeignKey(SessionEntry, on_delete=models.CASCADE, related_name="laps")
    lap_number = models.PositiveSmallIntegerField()
    lap_time_s = models.FloatField(null=True, blank=True)
    sector_1_s = models.FloatField(null=True, blank=True)
    sector_2_s = models.FloatField(null=True, blank=True)
    sector_3_s = models.FloatField(null=True, blank=True)
    is_pit_out_lap = models.BooleanField(default=False)
    is_pit_in_lap = models.BooleanField(default=False)
    started_at = models.DateTimeField(null=True, blank=True)
    speed_trap_kph = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["entry", "lap_number"]
        constraints = [
            models.UniqueConstraint(fields=["entry", "lap_number"], name="lap_unique_entry_number"),
            models.CheckConstraint(
                condition=Q(lap_time_s__isnull=True) | Q(lap_time_s__gt=0),
                name="lap_time_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.entry} L{self.lap_number}"


class Stint(models.Model):
    entry = models.ForeignKey(SessionEntry, on_delete=models.CASCADE, related_name="stints")
    stint_number = models.PositiveSmallIntegerField()
    compound = models.CharField(max_length=16, choices=Compound.choices)
    lap_start = models.PositiveSmallIntegerField(null=True, blank=True)
    lap_end = models.PositiveSmallIntegerField(null=True, blank=True)
    tyre_age_at_start = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Laps already on the set when fitted (0 = new)"
    )

    class Meta:
        ordering = ["entry", "stint_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "stint_number"], name="stint_unique_entry_number"
            ),
            models.CheckConstraint(
                condition=Q(lap_start__isnull=True)
                | Q(lap_end__isnull=True)
                | Q(lap_end__gte=F("lap_start")),
                name="stint_laps_ordered",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.entry} stint {self.stint_number} {self.compound}"


class PitStop(models.Model):
    entry = models.ForeignKey(SessionEntry, on_delete=models.CASCADE, related_name="pit_stops")
    lap_number = models.PositiveSmallIntegerField(help_text="Lap on which the car entered the pits")
    stop_number = models.PositiveSmallIntegerField(null=True, blank=True)
    occurred_at = models.DateTimeField(null=True, blank=True)
    pit_lane_duration_s = models.FloatField(null=True, blank=True, help_text="OpenF1 lane time")
    stationary_duration_s = models.FloatField(null=True, blank=True)
    reported_duration_s = models.FloatField(
        null=True, blank=True, help_text="Duration published by Jolpica"
    )

    class Meta:
        ordering = ["entry", "lap_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["entry", "lap_number"], name="pitstop_unique_entry_lap"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.entry} pit L{self.lap_number}"


class RaceControlMessage(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="race_control")
    occurred_at = models.DateTimeField()
    lap_number = models.PositiveSmallIntegerField(null=True, blank=True)
    category = models.CharField(max_length=32)
    flag = models.CharField(max_length=32, blank=True)
    scope = models.CharField(max_length=32, blank=True)
    sector = models.PositiveSmallIntegerField(null=True, blank=True)
    car_number = models.PositiveSmallIntegerField(null=True, blank=True)
    message = models.TextField()
    digest = models.CharField(max_length=64, help_text="sha256 of the message identity")

    class Meta:
        ordering = ["session", "occurred_at"]
        constraints = [
            models.UniqueConstraint(fields=["session", "digest"], name="rcm_unique_session_digest"),
        ]

    def __str__(self) -> str:
        return f"{self.occurred_at:%H:%M:%S} {self.message[:40]}"


class WeatherSample(models.Model):
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="weather")
    sampled_at = models.DateTimeField()
    air_temperature_c = models.FloatField(null=True, blank=True)
    track_temperature_c = models.FloatField(null=True, blank=True)
    humidity_pct = models.FloatField(null=True, blank=True)
    pressure_mbar = models.FloatField(null=True, blank=True)
    rainfall = models.BooleanField(default=False)
    wind_speed_ms = models.FloatField(null=True, blank=True)
    wind_direction_deg = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["session", "sampled_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "sampled_at"], name="weather_unique_session_time"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.session} {self.sampled_at:%H:%M}"


class TrackStatus(models.Model):
    """A neutralised period (SC, VSC, red flag), derived from race control messages."""

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="track_statuses")
    status = models.CharField(max_length=8, choices=TrackStatusKind.choices)
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    lap_start = models.PositiveSmallIntegerField(null=True, blank=True)
    lap_end = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["session", "started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["session", "status", "started_at"], name="trackstatus_unique_period"
            ),
        ]
        verbose_name_plural = "track statuses"

    def __str__(self) -> str:
        return f"{self.session} {self.status} L{self.lap_start}-{self.lap_end}"


class TrackOutline(models.Model):
    """The circuit as driven in this session: one car's positions over its reference lap
    (``racedata.derive.reference_lap``), sampled at about 3.7 Hz.

    Samples are evenly spaced in time, so a fraction of the lap maps directly to a sample
    index. The UI uses that to place every car on the map from its race time.
    """

    session = models.OneToOneField(Session, on_delete=models.CASCADE, related_name="track")
    car_number = models.PositiveSmallIntegerField()
    lap_number = models.PositiveSmallIntegerField()
    lap_time_s = models.FloatField()
    points = models.JSONField(help_text="[[x, y], ...] in OpenF1 plane units, in time order")

    def __str__(self) -> str:
        return f"{self.session} outline (car {self.car_number}, lap {self.lap_number})"


class Standing(models.Model):
    """Championship table line after a round (drivers' or constructors')."""

    season = models.ForeignKey(Season, on_delete=models.CASCADE, related_name="standings")
    round = models.PositiveSmallIntegerField()
    driver = models.ForeignKey(
        Driver, on_delete=models.CASCADE, null=True, blank=True, related_name="standings"
    )
    team = models.ForeignKey(
        Team, on_delete=models.CASCADE, null=True, blank=True, related_name="standings"
    )
    position = models.PositiveSmallIntegerField(null=True, blank=True)
    position_text = models.CharField(max_length=8, blank=True)
    points = models.FloatField(default=0.0)
    wins = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["season", "round", "position"]
        constraints = [
            models.UniqueConstraint(
                fields=["season", "round", "driver"],
                condition=models.Q(driver__isnull=False),
                name="standing_unique_driver",
            ),
            models.UniqueConstraint(
                fields=["season", "round", "team"],
                condition=models.Q(team__isnull=False),
                name="standing_unique_team",
            ),
            models.CheckConstraint(
                condition=models.Q(driver__isnull=True) ^ models.Q(team__isnull=True),
                name="standing_driver_xor_team",
            ),
        ]

    def __str__(self) -> str:
        who = self.driver or self.team
        return f"{self.season} R{self.round} P{self.position} {who}"


class TeamRadio(models.Model):
    """A team radio message: a reference to the official recording, never re-hosted."""

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name="team_radio")
    car_number = models.PositiveSmallIntegerField()
    recorded_at = models.DateTimeField()
    url = models.URLField(max_length=300)

    class Meta:
        ordering = ["session", "recorded_at"]
        constraints = [
            models.UniqueConstraint(fields=["session", "url"], name="radio_unique_session_url"),
        ]

    def __str__(self) -> str:
        return f"{self.session} #{self.car_number} {self.recorded_at:%H:%M:%S}"
