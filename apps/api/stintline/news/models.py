"""Headlines read from public news feeds (ADR 0012). Title and link only."""

from __future__ import annotations

from django.db import models


class Headline(models.Model):
    source = models.CharField(max_length=32, help_text="racedata FeedConfig.key")
    language = models.CharField(max_length=8)
    title = models.CharField(max_length=300)
    url = models.URLField(max_length=600, unique=True)
    published_at = models.DateTimeField()
    fetched_at = models.DateTimeField()

    class Meta:
        ordering = ["-published_at"]
        indexes = [models.Index(fields=["language", "-published_at"], name="headline_lang_date")]

    def __str__(self) -> str:
        return f"{self.source}: {self.title}"
