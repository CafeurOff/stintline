"""FIA event documents and the stewards' decisions read from them (ADR 0018).

PDFs are never stored: a document keeps its fia.com URL and the extracted text (search,
text alternative). The PDF is relayed on demand by the API.
"""

from __future__ import annotations

from django.db import models

from stintline.racing.models import Driver, Event, Session


class DocumentCategory(models.TextChoices):
    DECISION = "decision", "Decision"
    INFRINGEMENT = "infringement", "Infringement"
    SUMMONS = "summons", "Summons"
    CLASSIFICATION = "classification", "Classification"
    TECHNICAL = "technical", "Technical"
    NOTES = "notes", "Notes"
    OTHER = "other", "Other"


STEWARDS_CATEGORIES = (DocumentCategory.DECISION, DocumentCategory.INFRINGEMENT)
"""Documents whose text holds a stewards' decision about a car."""


class FiaEventListing(models.Model):
    """When the documents of a Grand Prix were last listed, under fia.com's own name."""

    event = models.OneToOneField(Event, on_delete=models.CASCADE, related_name="fia_listing")
    fia_name = models.CharField(max_length=128)
    listed_at = models.DateTimeField()
    documents = models.PositiveSmallIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.event} ({self.fia_name})"


class FiaDocument(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="fia_documents")
    number = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=300)
    category = models.CharField(max_length=16, choices=DocumentCategory.choices)
    published_at = models.DateTimeField()
    url = models.URLField(max_length=500, unique=True, help_text="fia.com PDF, a reference")
    cars = models.JSONField(default=list, help_text="Car numbers named in the title")
    text = models.TextField(blank=True, help_text="Text extracted from the PDF")
    text_fetched_at = models.DateTimeField(null=True, blank=True)
    listed_at = models.DateTimeField()

    class Meta:
        ordering = ["-published_at", "-number"]
        indexes = [
            models.Index(fields=["event", "-published_at"], name="fiadoc_event_date"),
            models.Index(fields=["text_fetched_at"], name="fiadoc_text_pending"),
        ]

    def __str__(self) -> str:
        return f"{self.event} doc {self.number} - {self.title}"


class StewardsDecision(models.Model):
    """A stewards' decision about one car, linked to the driver, session and lap."""

    document = models.OneToOneField(FiaDocument, on_delete=models.CASCADE, related_name="decision")
    car_number = models.PositiveSmallIntegerField(null=True, blank=True)
    driver = models.ForeignKey(
        Driver, on_delete=models.SET_NULL, null=True, blank=True, related_name="decisions"
    )
    driver_name = models.CharField(max_length=128, blank=True)
    session = models.ForeignKey(
        Session, on_delete=models.SET_NULL, null=True, blank=True, related_name="decisions"
    )
    session_label = models.CharField(max_length=64, blank=True)
    incident_time = models.CharField(max_length=5, blank=True, help_text="Local HH:MM")
    lap = models.PositiveSmallIntegerField(null=True, blank=True)
    fact = models.TextField(blank=True)
    infringement = models.TextField(blank=True)
    decision = models.TextField(blank=True)
    reason = models.TextField(blank=True)
    time_penalty_s = models.PositiveSmallIntegerField(default=0)
    drive_through = models.BooleanField(default=False)
    stop_go_s = models.PositiveSmallIntegerField(default=0)
    grid_places = models.PositiveSmallIntegerField(default=0)
    back_of_grid = models.BooleanField(default=False)
    pit_lane_start = models.BooleanField(default=False)
    penalty_points = models.PositiveSmallIntegerField(default=0)
    reprimand = models.BooleanField(default=False)
    fine_eur = models.PositiveIntegerField(default=0)
    disqualified = models.BooleanField(default=False)
    lap_time_deleted = models.BooleanField(default=False)
    no_further_action = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"{self.document} ({self.driver_name})"

    @property
    def is_penalty(self) -> bool:
        """A sporting penalty (time, grid, drive-through, points, disqualification)."""
        return bool(
            self.time_penalty_s
            or self.drive_through
            or self.stop_go_s
            or self.grid_places
            or self.back_of_grid
            or self.pit_lane_start
            or self.penalty_points
            or self.disqualified
            or self.lap_time_deleted
        )
