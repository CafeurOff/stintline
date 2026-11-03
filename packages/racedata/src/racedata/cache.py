"""Response caches. Historical timing data never changes once published, so a simple
content-addressed file cache saves most upstream calls during development and backfills.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any, Protocol


def cache_key(provider: str, url: str, params: Mapping[str, str]) -> str:
    """Stable key for a request: provider, URL and sorted query parameters."""
    canonical = json.dumps([provider, url, sorted(params.items())], separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


class ResponseCache(Protocol):
    def get(self, key: str) -> Any | None: ...

    def set(self, key: str, value: Any) -> None: ...


class NullCache:
    """Cache that stores nothing."""

    def get(self, key: str) -> Any | None:
        return None

    def set(self, key: str, value: Any) -> None:
        return None


class FileCache:
    """JSON files under ``root/<key[:2]>/<key>.json``, written atomically."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def _path(self, key: str) -> Path:
        return self.root / key[:2] / f"{key}.json"

    def get(self, key: str) -> Any | None:
        path = self._path(key)
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    def set(self, key: str, value: Any) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(value, fh)
        Path(tmp).replace(path)
