"""Facts read from the FIA technical documents (ADR 0019): car upgrades and power-unit
elements. Every row points to the document it was read from."""

from __future__ import annotations

from django.db import models

from stintline.paddock.models import FiaDocument
from stintline.racing.models import Driver, Event, Team


class CarZone(models.TextChoices):
    """Where a component sits on the car, for the top-down drawing."""

    FRONT_WING = "front_wing", "Front wing"
    NOSE = "nose", "Nose"
    FRONT_CORNER = "front_corner", "Front corner"
    FRONT_SUSPENSION = "front_suspension", "Front suspension"
    FLOOR = "floor", "Floor"
    DIFFUSER = "diffuser", "Diffuser"
    SIDEPOD = "sidepod", "Sidepod"
    ENGINE_COVER = "engine_cover", "Engine cover and cooling"
    COCKPIT = "cockpit", "Cockpit and mirrors"
    REAR_CORNER = "rear_corner", "Rear corner"
    REAR_SUSPENSION = "rear_suspension", "Rear suspension"
    BEAM_WING = "beam_wing", "Beam wing"
    REAR_WING = "rear_wing", "Rear wing"
    OTHER = "other", "Other"


class CarUpgrade(models.Model):
    document = models.ForeignKey(FiaDocument, on_delete=models.CASCADE, related_name="upgrades")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="upgrades")
    team = models.ForeignKey(
        Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="upgrades"
    )
    team_name = models.CharField(max_length=128, help_text="As printed by the team")
    number = models.PositiveSmallIntegerField()
    component = models.CharField(max_length=128)
    zone = models.CharField(max_length=24, choices=CarZone.choices)
    reason = models.CharField(max_length=16)
    reason_detail = models.CharField(max_length=200, blank=True)
    difference = models.TextField(blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["event__race_date", "team_name", "number"]
        constraints = [
            models.UniqueConstraint(
                fields=["document", "team_name", "number"], name="upgrade_unique_item"
            )
        ]

    def __str__(self) -> str:
        return f"{self.event} {self.team_name} {self.number} {self.component}"


class TeamWithoutUpgrade(models.Model):
    """A team that declared "No updates submitted for this event"."""

    document = models.ForeignKey(FiaDocument, on_delete=models.CASCADE, related_name="no_updates")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="no_updates")
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)
    team_name = models.CharField(max_length=128)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["document", "team_name"], name="no_update_unique")
        ]

    def __str__(self) -> str:
        return f"{self.event} {self.team_name}: no updates"


class PowerUnitUsage(models.Model):
    """Running total of one element for one car, as of the document's weekend."""

    document = models.ForeignKey(FiaDocument, on_delete=models.CASCADE, related_name="pu_usage")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="pu_usage")
    car_number = models.PositiveSmallIntegerField()
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True)
    label = models.CharField(max_length=128)
    element = models.CharField(max_length=8)
    used = models.PositiveSmallIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document", "car_number", "element"], name="pu_usage_unique"
            )
        ]

    def __str__(self) -> str:
        return f"{self.event} #{self.car_number} {self.element}={self.used}"


class PowerUnitChange(models.Model):
    """A new element fitted for a weekend, with the allowance the document states."""

    document = models.ForeignKey(FiaDocument, on_delete=models.CASCADE, related_name="pu_changes")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="pu_changes")
    car_number = models.PositiveSmallIntegerField()
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True)
    label = models.CharField(max_length=128)
    element = models.CharField(max_length=8)
    previous = models.PositiveSmallIntegerField()
    number = models.PositiveSmallIntegerField()
    allowed = models.PositiveSmallIntegerField(null=True, blank=True)
    compliant = models.BooleanField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["document", "car_number", "element"], name="pu_change_unique"
            )
        ]

    def __str__(self) -> str:
        return f"{self.event} #{self.car_number} {self.element} #{self.number}"
