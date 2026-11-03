"""Celery application. Tasks are auto-discovered from installed apps."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("stintline")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
