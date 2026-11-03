"""StintLine strategy engine.

Pure Python, framework-free and I/O-free. Inputs are plain typed values, and every
modelling assumption is an explicit, documented parameter (see ``docs/model.md``).
"""

from stintline_strategy.units import LapTime, format_lap_time, parse_lap_time

__all__ = ["LapTime", "format_lap_time", "parse_lap_time"]
__version__ = "0.1.0"
