from django.apps import AppConfig


class IngestionConfig(AppConfig):
    """Idempotent import of provider data into the racing models."""

    name = "stintline.ingestion"
    label = "ingestion"
    verbose_name = "Ingestion"
