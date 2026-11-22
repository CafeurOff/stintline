"""Settings shared by every environment. All deployment-specific values come from the
environment (see ``.env.example`` at the repository root). There are no default secrets.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote

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
    "django.contrib.postgres",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
    "channels",
    "django_prometheus",
    "stintline.core",
    "stintline.racing",
    "stintline.ingestion",
    "stintline.strategy_api",
    "stintline.live",
    "stintline.news",
    "stintline.analysis",
    "stintline.paddock",
    "stintline.technical",
    "stintline.forecast",
    "stintline.championship",
    "stintline.seo",
]

MIDDLEWARE = [
    # Request counts and latency per view for /metrics (ADR 0027): first and last.
    "django_prometheus.middleware.PrometheusBeforeMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "django_prometheus.middleware.PrometheusAfterMiddleware",
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
# A Unix socket directory written as a percent-encoded host (vps-infra:
# postgresql://user@%2Fvar%2Frun%2Fpostgresql/db) is not decoded by django-environ.
DATABASES["default"]["HOST"] = unquote(DATABASES["default"].get("HOST", ""))
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
    # News feed headlines (ADR 0012).
    "refresh-headlines": {
        "task": "stintline.news.tasks.refresh_headlines",
        "schedule": 30 * 60,
    },
    # FIA documents and stewards' decisions (ADR 0018).
    "refresh-fia-documents": {
        "task": "stintline.paddock.tasks.refresh_fia_documents",
        "schedule": 30 * 60,
    },
    # Weather forecasts of upcoming sessions (ADR 0020). Open-Meteo updates hourly; every
    # 3 h keeps them current with one call per weekend.
    "refresh-forecasts": {
        "task": "stintline.forecast.tasks.refresh_forecasts",
        "schedule": 3 * 60 * 60,
    },
    "refresh-portraits": {
        "task": "stintline.ingestion.tasks.refresh_portraits",
        "schedule": 7 * 24 * 60 * 60,
    },
}

FIA_SEASONS: list[int] = env.list("FIA_SEASONS", cast=int, default=[2025, 2026])
"""Seasons whose FIA documents are imported (ADR 0018)."""
FIA_REQUEST_INTERVAL_S: float = env.float("FIA_REQUEST_INTERVAL_S", default=10.0)
"""fia.com robots.txt asks for 10 s between requests, shared by every process."""

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
        "DocumentCategoryEnum": "stintline.paddock.models.DocumentCategory",
    },
}

OFFICIAL_MEDIA_ENABLED: bool = env.bool("OFFICIAL_MEDIA_ENABLED", default=True)
"""Return official portrait and car image URLs (references only, ADR 0006)."""

NEWS_IMAGES_ENABLED: bool = env.bool("NEWS_IMAGES_ENABLED", default=True)
"""Return the publishers' headline image URLs (references only, never downloaded, ADR 0015)."""

RACEDATA = {
    "MODE": env.str("RACEDATA_MODE", default="http"),
    "CACHE_DIR": env.str("RACEDATA_CACHE_DIR", default=str(BASE_DIR / ".racedata-cache")),
    "OPENF1_BASE_URL": env.str("OPENF1_BASE_URL", default="https://api.openf1.org/v1"),
    "JOLPICA_BASE_URL": env.str("JOLPICA_BASE_URL", default="https://api.jolpi.ca/ergast/f1"),
    # Team radio clips through a relay when the live timing CDN refuses this server (ADR 0029).
    "RADIO_RELAY_URL": env.str("RADIO_RELAY_URL", default=""),
    "RADIO_RELAY_TOKEN": env.str("RADIO_RELAY_TOKEN", default=""),
}

RADIO_TRANSCRIPTION = {
    # Team radio speech-to-text on this machine (ADR 0029). Defaults in racedata.radio.
    "ENABLED": env.bool("RADIO_TRANSCRIPTION_ENABLED", default=True),
    "MODEL": env.str("RADIO_WHISPER_MODEL", default="base.en"),
    "MODEL_DIR": env.str("RADIO_WHISPER_DIR", default=str(BASE_DIR / ".whisper-models")),
    "CPU_THREADS": env.int("RADIO_WHISPER_THREADS", default=0),
}


def _release_version() -> str:
    """The tag of the running release: vps-infra writes it to VERSION at the release root
    (ADR 0027). Without it (development, tests, Docker), the package version."""
    path = REPO_ROOT / "VERSION"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip().removeprefix("v") or "0.1.0"
    return "0.1.0"


STINTLINE_VERSION: str = env.str("STINTLINE_VERSION", default=_release_version())

LOGGING = build_logging_config(
    json_logs=env.bool("LOG_JSON", default=False),
    level=env.str("LOG_LEVEL", default="INFO"),
)

# Web pages rendered with their head (ADR 0025). The built index.html of the web app, and the
# French Grand Prix names it shares with the API. SITE_URL forces the canonical origin (else
# the request's).
SPA_INDEX_PATH: str = env.str("SPA_INDEX_PATH", default=str(REPO_ROOT / "apps/web/dist/index.html"))
EVENT_NAMES_FR_PATH: str = env.str(
    "EVENT_NAMES_FR_PATH", default=str(REPO_ROOT / "apps/web/src/lib/i18n/event-names.fr.json")
)
SITE_URL: str = env.str("SITE_URL", default="")
