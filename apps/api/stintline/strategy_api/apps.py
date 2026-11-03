from django.apps import AppConfig


class StrategyApiConfig(AppConfig):
    """Bridges stored race data and the strategy engine (adapters, API, backtest)."""

    name = "stintline.strategy_api"
    label = "strategy_api"
    verbose_name = "Strategy"
