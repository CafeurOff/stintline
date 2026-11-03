from django.apps import AppConfig


class CoreConfig(AppConfig):
    """Cross-cutting concerns: health checks, error format, shared API utilities."""

    name = "stintline.core"
    label = "core"
    verbose_name = "Core"
