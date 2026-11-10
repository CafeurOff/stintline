"""Celery application. Tasks are auto-discovered from installed apps."""

import os
from typing import Any

from celery import Celery
from celery.signals import worker_ready

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("stintline")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

REFRESH_TASK = "stintline.ingestion.tasks.refresh_recent"
HEADLINES_TASK = "stintline.news.tasks.refresh_headlines"


@worker_ready.connect
def catch_up_on_start(sender: Any, **kwargs: Any) -> None:
    """Catch up as soon as a worker starts: beat schedules only fire after their interval,
    and anything that finished while the stack was down must not wait for it."""
    sender.app.send_task(REFRESH_TASK)
    sender.app.send_task(HEADLINES_TASK)
