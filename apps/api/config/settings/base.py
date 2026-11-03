"""Settings shared by every environment. All deployment-specific values come from the
environment (see ``.env.example`` at the repository root). There are no default secrets.
"""

from __future__ import annotations

from pathlib import Path

import django_stubs_ext
import environ

from config.logging import build_logging_config

# Makes generic classes such as ``ModelAdmin[Model]`` subscriptable at runtime.
django_stubs_ext.monkeypatch()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BASE_DIR.parent.parent

env = environ.Env()
environ.Env.read_env(REPO_ROOT / ".env", overwrite=False)

SECRET_KEY: str = env.str("DJANGO_SECRET_KEY")
DEBUG: bool = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS: list[str] = env.list("DJANGO_ALLOWED_HOSTS", default=[])
ADMIN_ENABLED: bool = env.bool("DJANGO_ADMIN_ENABLED", default=False)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "channels",
    "stintline.core",
    "stintline.racing",
    "stintline.ingestion",
    "stintline.strategy_api",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
ASGI_APPLICATION = "config.asgi.application"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DATABASE_CONN_MAX_AGE", default=60)

REDIS_URL: str = env.str("REDIS_URL", default="redis://localhost:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TIMEZONE = "UTC"
CELERY_BEAT_SCHEDULE = {
    # Keep everything up to date: current calendar, races and sprints shortly after they
    # finish, anything missed while the stack was down (stintline.ingestion.tasks).
    # Also queued when a worker starts (config.celery).
    "refresh-recent-sessions": {
        "task": "stintline.ingestion.tasks.refresh_recent",
        "schedule": 30 * 60,
    },
    "refresh-portraits": {
        "task": "stintline.ingestion.tasks.refresh_portraits",
        "schedule": 7 * 24 * 60 * 60,
    },
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS: list[str] = env.list("CORS_ALLOWED_ORIGINS", default=[])
CORS_ALLOW_CREDENTIALS = False  # public read-only API, no cookies

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.LimitOffsetPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "stintline.core.api.exceptions.problem_exception_handler",
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.ScopedRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"simulate": env.str("SIMULATE_RATE", default="240/min")},
}

SPECTACULAR_SETTINGS = {
    "TITLE": "StintLine API",
    "DESCRIPTION": (
        "Race strategy analysis for Formula 1 timing data: stints, tyre degradation, "
        "pit loss, undercut and pit-exit simulation. Unofficial project, not associated "
        "with Formula 1, the FIA or any team."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "ComponentStatusEnum": "stintline.core.api.serializers.COMPONENT_STATUS_CHOICES",
        "TyreCompoundEnum": "stintline.strategy_api.api.serializers.COMPOUND_CHOICES",
    },
}

OFFICIAL_MEDIA_ENABLED: bool = env.bool("OFFICIAL_MEDIA_ENABLED", default=True)
"""Return official portrait and car image URLs (references only, ADR 0006)."""

RACEDATA = {
    "MODE": env.str("RACEDATA_MODE", default="http"),
    "CACHE_DIR": env.str("RACEDATA_CACHE_DIR", default=str(BASE_DIR / ".racedata-cache")),
    "OPENF1_BASE_URL": env.str("OPENF1_BASE_URL", default="https://api.openf1.org/v1"),
    "JOLPICA_BASE_URL": env.str("JOLPICA_BASE_URL", default="https://api.jolpi.ca/ergast/f1"),
}

STINTLINE_VERSION: str = env.str("STINTLINE_VERSION", default="0.1.0")

LOGGING = build_logging_config(
    json_logs=env.bool("LOG_JSON", default=False),
    level=env.str("LOG_LEVEL", default="INFO"),
)
