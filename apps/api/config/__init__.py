"""Django project configuration. Importing it also registers the Celery app."""

from config.celery import app as celery_app

__all__ = ["celery_app"]
