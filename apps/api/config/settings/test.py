"""Test settings: deterministic and offline. Postgres when DATABASE_URL is set (CI),
in-memory SQLite otherwise. No Redis: in-memory cache, channel layer and eager Celery.
"""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "test-only-insecure-key")
os.environ.setdefault("DATABASE_URL", "sqlite://:memory:")

from config.settings.base import *  # noqa: F403

DEBUG = False
ALLOWED_HOSTS = ["testserver", "localhost"]
ADMIN_ENABLED = True
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = "memory://"
CELERY_RESULT_BACKEND = "cache+memory://"
STORAGES = {
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# WhiteNoise only matters for collected static files in production images.
MIDDLEWARE = [m for m in MIDDLEWARE if not m.startswith("whitenoise.")]  # noqa: F405

RACEDATA = {**RACEDATA, "MODE": "fixtures", "CACHE_DIR": None}  # noqa: F405

FIA_REQUEST_INTERVAL_S = 0.0
