"""The model card: every modelling assumption with its default and its documented reason,
read from the engine's config dataclasses, and the stored backtest reports.
"""

from __future__ import annotations

import dataclasses
import json
import re
from functools import cache
from pathlib import Path
from typing import Any

from stintline_strategy import __version__ as engine_version
from stintline_strategy.degradation import (
    DegradationConfig,
)
from stintline_strategy.fuel import FuelModel
from stintline_strategy.laps import CleaningConfig
from stintline_strategy.pit_exit import PitExitConfig
from stintline_strategy.pit_loss import PitLossConfig
from stintline_strategy.whatif import (
    WhatIfConfig,
)
from stintline_strategy.window import WindowConfig

DATA_DIR = Path(__file__).resolve().parent / "data"


# Python 3.13 dedents docstrings: attribute names sit at 0-4 spaces, continuations deeper.
_ATTRIBUTE = re.compile(r"^\s{0,4}(\w+):\s+(.*)$")


def _attribute_docs(cls: type) -> dict[str, str]:
    """Parse the ``Attributes:`` section of a config dataclass docstring."""
    docs: dict[str, str] = {}
    current: str | None = None
    for line in (cls.__doc__ or "").splitlines():
        match = _ATTRIBUTE.match(line)
        if match:
            current = match.group(1)
            docs[current] = match.group(2).strip()
        elif current and line.strip() and not line.strip().endswith(":"):
            docs[current] += " " + line.strip()
        elif not line.strip():
            current = None
    return docs


CONFIG_CLASSES: tuple[tuple[str, type], ...] = (
    ("Lap cleaning", CleaningConfig),
    ("Fuel", FuelModel),
    ("Degradation", DegradationConfig),
    ("Pit loss", PitLossConfig),
    ("Pit exit", PitExitConfig),
    ("Pit window", WindowConfig),
    ("What-if", WhatIfConfig),
)


@cache
def model_card() -> dict[str, Any]:
    assumptions = []
    for group, cls in CONFIG_CLASSES:
        docs = _attribute_docs(cls)
        instance = cls()
        for f in dataclasses.fields(instance):
            assumptions.append(
                {
                    "group": group,
                    "name": f.name,
                    "value": str(getattr(instance, f.name)),
                    "description": docs.get(f.name, ""),
                }
            )
    backtest = {
        name: json.loads((DATA_DIR / f"backtest-2025-{name}.json").read_text(encoding="utf-8"))
        for name in ("reference", "held-out")
    }
    return {"engine_version": engine_version, "assumptions": assumptions, "backtest": backtest}
