"""Recorded upstream responses used by tests and by the offline demo seed.

Layout: ``<root>/<provider>/<request path>/<query slug>.json`` with a sibling
``.meta.json`` (URL, params, recorded_at, sha256, dropped fields). The same slug function
is used to record and to replay, so a test can never hit the network by accident: an
unknown request raises :class:`MissingFixtureError` instead.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from pathlib import Path
from typing import Any

import httpx

FIXTURES_ROOT = Path(__file__).resolve().parents[2] / "fixtures"
"""Default fixture directory: ``packages/racedata/fixtures``."""

_UNSAFE = re.compile(r"[^A-Za-z0-9_.=-]+")


class MissingFixtureError(LookupError):
    """A request was made in fixture mode but no recording matches it."""


MAX_SLUG_CHARS = 150
"""File names stay well under the usual 255-byte limit."""


def _safe(text: str) -> str:
    """Filesystem-safe component: no separators and no ``..`` (path traversal)."""
    return _UNSAFE.sub("_", text).replace("..", "_")


def fixture_path(
    root: Path, provider: str, path: str, params: Mapping[str, str], suffix: str = ".json"
) -> Path:
    """Deterministic file location for a request (``suffix`` is ``.xml`` for feeds)."""
    clean_path = "/".join(
        _safe(part) for part in path.strip("/").split("/") if part not in ("", ".", "..")
    )
    slug = "__".join(_safe(f"{k}={v}") for k, v in sorted(params.items())) or "_"
    if len(slug) > MAX_SLUG_CHARS:
        # Long queries (50 Wikipedia titles) exceed file name limits: keep a readable
        # prefix and make the name unique with a digest of the full query.
        digest = hashlib.sha256(slug.encode()).hexdigest()[:16]
        slug = f"{slug[: MAX_SLUG_CHARS - 18]}__{digest}"
    return root / provider / clean_path / f"{slug}{suffix}"


def load_fixture(file: Path) -> Any:
    return json.loads(file.read_text(encoding="utf-8"))


class FixtureTransport(httpx.BaseTransport):
    """httpx transport serving recorded responses for one provider.

    ``base_path`` is the URL path prefix of the provider (e.g. ``/v1`` for OpenF1) and is
    stripped before looking up the fixture.
    """

    def __init__(
        self,
        provider: str,
        base_path: str = "",
        root: Path = FIXTURES_ROOT,
        suffix: str = ".json",
    ) -> None:
        self.provider = provider
        self.base_path = base_path.rstrip("/")
        self.root = root
        self.suffix = suffix

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if self.base_path and path.startswith(self.base_path):
            path = path[len(self.base_path) :]
        params = dict(request.url.params.items())
        file = fixture_path(self.root, self.provider, path, params, self.suffix)
        if not file.exists():
            raise MissingFixtureError(
                f"No fixture for {self.provider} {request.url} (expected {file}). "
                "Record it with `/new-provider-fixture`."
            )
        return httpx.Response(200, content=file.read_bytes(), request=request)


def fia_suffix(path: str) -> str:
    """fia.com serves HTML list pages and PDF documents from one host."""
    return ".pdf" if path.lower().endswith(".pdf") else ".html"


class FiaFixtureTransport(FixtureTransport):
    """Fixture transport for fia.com: ``.html`` for list pages, ``.pdf`` for documents."""

    def __init__(self, root: Path = FIXTURES_ROOT) -> None:
        super().__init__("fia", "", root)

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        self.suffix = fia_suffix(request.url.path)
        return super().handle_request(request)
