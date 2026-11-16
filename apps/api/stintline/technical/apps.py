from django.apps import AppConfig


class TechnicalConfig(AppConfig):
    name = "stintline.technical"
    label = "technical"
    verbose_name = "Technical: upgrades, power units and incidents (ADR 0019)"

    def ready(self) -> None:
        # Imported here: models must be ready before the readers module loads them.
        from stintline.paddock import readers  # noqa: PLC0415
        from stintline.technical import reading  # noqa: PLC0415

        readers.register(reading.READERS)
