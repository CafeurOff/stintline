from config.logging import build_logging_config


def test_logging_config_uses_json_renderer_in_production() -> None:
    config = build_logging_config(json_logs=True, level="WARNING")

    processors = config["formatters"]["structured"]["processors"]
    assert type(processors[-1]).__name__ == "JSONRenderer"
    assert config["root"]["level"] == "WARNING"


def test_logging_config_uses_console_renderer_in_development() -> None:
    config = build_logging_config(json_logs=False, level="INFO")

    processors = config["formatters"]["structured"]["processors"]
    assert type(processors[-1]).__name__ == "ConsoleRenderer"
