"""Merge incremental feed updates into the topic state.

The feed sends partial objects: nested dicts merge key by key, and lists are updated
through dicts keyed by index (``{"Sectors": {"2": {"Value": "31.2"}}}``). A key
``_deleted`` lists keys to remove. Anything else replaces the previous value.
"""

from __future__ import annotations

import copy
from typing import Any

DELETED = "_deleted"


def merge(target: Any, update: Any) -> Any:
    """Return ``target`` with ``update`` applied (``target`` is modified in place when it
    is a dict or a list)."""
    if isinstance(update, dict):
        if isinstance(target, list):
            return _merge_list(target, update)
        if not isinstance(target, dict):
            target = {}
        for key in update.get(DELETED, []) if isinstance(update.get(DELETED), list) else []:
            target.pop(str(key), None)
        for key, value in update.items():
            if key == DELETED:
                continue
            target[key] = merge(target.get(key), value)
        return target
    return copy.deepcopy(update) if isinstance(update, list) else update


def _merge_list(target: list[Any], update: dict[str, Any]) -> list[Any]:
    for key, value in update.items():
        if not key.isdigit():
            continue
        index = int(key)
        while len(target) <= index:
            target.append(None)
        target[index] = merge(target[index], value)
    return target


class LiveState:
    """Current value of every topic, rebuilt from a snapshot then feed updates."""

    def __init__(self) -> None:
        self.topics: dict[str, Any] = {}

    def apply_snapshot(self, topics: dict[str, Any]) -> None:
        self.topics = copy.deepcopy(topics)

    def apply_feed(self, topic: str, payload: Any) -> None:
        self.topics[topic] = merge(self.topics.get(topic), payload)

    def get(self, topic: str) -> dict[str, Any]:
        value = self.topics.get(topic)
        return value if isinstance(value, dict) else {}
