"""Weather forecast for an upcoming session (Open-Meteo, ADR 0020)."""

from __future__ import annotations

from django.db import models

from stintline.racing.models import Session


class SessionForecast(models.Model):
    """The latest forecast over a session's window, summarised, with its hourly points.

    Replaced on every refresh: only the latest forecast matters.
    """

    session = models.OneToOneField(Session, on_delete=models.CASCADE, related_name="forecast")
    fetched_at = models.DateTimeField()
    window_start = models.DateTimeField()
    window_end = models.DateTimeField()
    air_c = models.FloatField(null=True, help_text="Mean air temperature over the window")
    air_min_c = models.FloatField(null=True)
    air_max_c = models.FloatField(null=True)
    rain_probability_pct = models.FloatField(
        null=True, help_text="Highest hourly chance of rain over the window"
    )
    precipitation_mm = models.FloatField(null=True, help_text="Rain expected over the window")
    wind_ms = models.FloatField(null=True, help_text="Strongest hourly mean wind")
    weather_code = models.PositiveSmallIntegerField(
        null=True, help_text="Most severe WMO weather code over the window"
    )
    hours = models.JSONField(default=list, help_text="Hourly points around the window")

    class Meta:
        ordering = ["window_start"]

    def __str__(self) -> str:
        return f"Forecast {self.session}"
