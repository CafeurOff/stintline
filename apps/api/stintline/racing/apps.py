from django.apps import AppConfig


class RacingConfig(AppConfig):
    """Race data model: seasons, events, sessions, entries, laps, stints and pit stops."""

    name = "stintline.racing"
    label = "racing"
    verbose_name = "Racing data"
