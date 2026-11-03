"""Read-mostly admin for inspecting ingested data."""

from django.contrib import admin

from stintline.racing import models


@admin.register(models.Season)
class SeasonAdmin(admin.ModelAdmin[models.Season]):
    list_display = ["year"]


@admin.register(models.Circuit)
class CircuitAdmin(admin.ModelAdmin[models.Circuit]):
    list_display = ["name", "locality", "country", "ref"]
    search_fields = ["name", "locality", "country"]


@admin.register(models.Event)
class EventAdmin(admin.ModelAdmin[models.Event]):
    list_display = ["season", "round", "name", "circuit", "race_date", "format"]
    list_filter = ["season", "format"]
    list_select_related = ["season", "circuit"]


@admin.register(models.Session)
class SessionAdmin(admin.ModelAdmin[models.Session]):
    list_display = ["event", "kind", "scheduled_start", "openf1_session_key", "ingested_at"]
    list_filter = ["kind", "event__season"]
    list_select_related = ["event__season"]


@admin.register(models.Team)
class TeamAdmin(admin.ModelAdmin[models.Team]):
    list_display = ["name", "ref"]


@admin.register(models.Driver)
class DriverAdmin(admin.ModelAdmin[models.Driver]):
    list_display = ["family_name", "given_name", "code", "ref"]
    search_fields = ["family_name", "code"]


@admin.register(models.SessionEntry)
class SessionEntryAdmin(admin.ModelAdmin[models.SessionEntry]):
    list_display = ["session", "car_number", "driver", "team", "grid_position", "finish_position"]
    list_select_related = ["session__event__season", "driver", "team"]
    list_filter = ["session__event__season"]


@admin.register(models.Stint)
class StintAdmin(admin.ModelAdmin[models.Stint]):
    list_display = [
        "entry",
        "stint_number",
        "compound",
        "lap_start",
        "lap_end",
        "tyre_age_at_start",
    ]
    list_select_related = ["entry__driver", "entry__session__event__season"]


@admin.register(models.PitStop)
class PitStopAdmin(admin.ModelAdmin[models.PitStop]):
    list_display = ["entry", "lap_number", "pit_lane_duration_s", "reported_duration_s"]
    list_select_related = ["entry__driver", "entry__session__event__season"]


@admin.register(models.TrackStatus)
class TrackStatusAdmin(admin.ModelAdmin[models.TrackStatus]):
    list_display = ["session", "status", "lap_start", "lap_end", "started_at", "ended_at"]
