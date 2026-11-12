"""Per-race figures computed once by the strategy engine and stored (ADR 0017).

Season and circuit pages read these rows instead of running the engine over every race of
a season on each request. :mod:`stintline.analysis.build` writes them after each import.
"""

from __future__ import annotations

from django.db import models

from stintline.racing.models import Session, SessionEntry

MIN_LOSS_STOPS = 8
"""Green-flag stops a race needs before its pit loss stands for the circuit."""
MAX_LOSS_SPREAD = 0.25
"""Largest spread (σ / loss) of a pit loss that stands for the circuit. Dry races sit
around 5 %; a quarter means the stops measured different things."""


class RaceStats(models.Model):
    """One race or sprint: what the engine and the stored data say about it."""

    session = models.OneToOneField(Session, on_delete=models.CASCADE, related_name="stats")
    format_version = models.PositiveSmallIntegerField()
    built_at = models.DateTimeField()
    total_laps = models.PositiveSmallIntegerField()
    field_median_s = models.FloatField(
        null=True, blank=True, help_text="Median of the cars' fuel-corrected clean-lap medians"
    )
    fastest_lap_s = models.FloatField(null=True, blank=True)
    pit_loss_s = models.FloatField(null=True, blank=True, help_text="Green-flag pit loss")
    pit_loss_sigma_s = models.FloatField(null=True, blank=True)
    pit_loss_stops = models.PositiveSmallIntegerField(default=0)
    safety_cars = models.PositiveSmallIntegerField(default=0)
    virtual_safety_cars = models.PositiveSmallIntegerField(default=0)
    red_flags = models.PositiveSmallIntegerField(default=0)
    neutralised_laps = models.PositiveSmallIntegerField(default=0)
    passes = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text="Green-flag on-track passes (null: no running order)"
    )
    wet = models.BooleanField(default=False, help_text="Intermediate or wet tyres were used")
    degradation = models.JSONField(
        default=dict, help_text="{compound: fuel-corrected s/lap} for compounds with a fit"
    )
    undercuts = models.JSONField(
        default=list,
        help_text="Undercut attempts: attacker, defender, attacker_lap, defender_lap, "
        "gap_before_s, gap_after_s",
    )
    winner_strategy = models.JSONField(
        default=list, help_text="Compounds of the winner's stints, one per stop plus the start"
    )
    lap_length_m = models.FloatField(null=True, blank=True, help_text="From the fastest lap")
    top_speed_kph = models.FloatField(null=True, blank=True)
    full_throttle_share = models.FloatField(null=True, blank=True)
    braking_zones = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "race stats"

    def __str__(self) -> str:
        return f"stats {self.session}"

    @property
    def pit_loss_reliable(self) -> bool:
        """Whether the pit loss can stand for the circuit (season and circuit summaries).

        A red flag missing from the timing, a wet race or a handful of stops can give a
        figure that says nothing about the pit lane (Monza 2026: 6 measurable stops)."""
        return (
            self.pit_loss_s is not None
            and self.pit_loss_sigma_s is not None
            and not self.wet
            and self.pit_loss_stops >= MIN_LOSS_STOPS
            and self.pit_loss_sigma_s <= MAX_LOSS_SPREAD * self.pit_loss_s
        )


class EntryRaceStats(models.Model):
    """One driver in one race or sprint."""

    entry = models.OneToOneField(SessionEntry, on_delete=models.CASCADE, related_name="stats")
    clean_laps = models.PositiveSmallIntegerField(default=0)
    median_s = models.FloatField(null=True, blank=True, help_text="Median clean lap, raw")
    median_corrected_s = models.FloatField(
        null=True, blank=True, help_text="Median clean lap at an empty tank (fuel model)"
    )
    spread_s = models.FloatField(
        null=True, blank=True, help_text="Lap-to-lap scatter once tyre wear is removed"
    )
    laps_led = models.PositiveSmallIntegerField(null=True, blank=True)
    passes_made = models.PositiveSmallIntegerField(null=True, blank=True)
    passes_lost = models.PositiveSmallIntegerField(null=True, blank=True)
    stops = models.PositiveSmallIntegerField(default=0)
    best_stationary_s = models.FloatField(null=True, blank=True)
    best_lane_s = models.FloatField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "entry race stats"

    def __str__(self) -> str:
        return f"stats {self.entry}"
