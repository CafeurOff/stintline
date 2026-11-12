"""Record an upstream response as a test fixture.

Usage::

    uv run python -m racedata.tools.record_fixture openf1 laps session_key=9998
    uv run python -m racedata.tools.record_fixture jolpica 2025/4/results limit=100
    uv run python -m racedata.tools.record_fixture feeds autosport

Large or sensitive fields are dropped (listed in the ``.meta.json``). This is the only
sanctioned way to call upstream APIs outside the running application.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from xml.etree.ElementTree import tostring

from defusedxml import ElementTree

from racedata.config import FEEDS, PROVIDERS
from racedata.fixtures import FIXTURES_ROOT, fixture_path
from racedata.http import HttpClient
from racedata.providers.feeds import ACCEPT

# Fields removed before saving: mini-sector arrays are large and unused. Media URLs are
# kept as plain references (never downloaded or stored, see ADR 0006).
DROPPED_FIELDS: dict[tuple[str, str], frozenset[str]] = {
    ("openf1", "laps"): frozenset({"segments_sector_1", "segments_sector_2", "segments_sector_3"}),
}
MAX_FIXTURE_BYTES = 750_000


def trim(provider: str, path: str, data: Any) -> tuple[Any, list[str]]:
    endpoint = path.strip("/").split("/")[-1]
    dropped = DROPPED_FIELDS.get((provider, endpoint), frozenset())
    if not dropped or not isinstance(data, list):
        return data, []
    return [{k: v for k, v in row.items() if k not in dropped} for row in data], sorted(dropped)


def serialise(data: Any) -> str:
    """One JSON record per line for lists: compact yet reviewable in diffs."""
    if isinstance(data, list):
        lines = ",\n".join(json.dumps(row, separators=(",", ":"), sort_keys=True) for row in data)
        return f"[\n{lines}\n]\n"
    return json.dumps(data, indent=1, sort_keys=True) + "\n"


def record(provider: str, path: str, params: dict[str, str], root: Path) -> Path:
    cfg = PROVIDERS[provider]
    client = HttpClient(provider, cfg.base_url, limits=cfg.limits)
    try:
        data = client.get_json(path, params)
    finally:
        client.close()
    data, dropped = trim(provider, path, data)
    body = serialise(data)
    if len(body.encode()) > MAX_FIXTURE_BYTES:
        raise SystemExit(
            f"Fixture is {len(body.encode())} bytes (> {MAX_FIXTURE_BYTES}). Narrow the query."
        )
    file = fixture_path(root, provider, path, params)
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(body, encoding="utf-8")
    meta = {
        "provider": provider,
        "url": f"{cfg.base_url}/{path.strip('/')}",
        "params": params,
        "recorded_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(body.encode()).hexdigest(),
        "bytes": len(body.encode()),
        "dropped_fields": dropped,
    }
    file.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return file


FEED_ITEMS_KEPT = 12
FEED_ITEM_FIELDS = frozenset(
    {
        "title",
        "link",
        "pubDate",
        "guid",
        "category",
        "enclosure",
        "{http://search.yahoo.com/mrss/}content",
        "{http://search.yahoo.com/mrss/}thumbnail",
    }
)
"""Article summaries and bodies are removed: fixtures never hold article text. Image
references (URLs only) are kept, since headlines carry them (ADR 0015)."""


def trim_feed(body: str, keep: int = FEED_ITEMS_KEPT) -> tuple[str, list[str]]:
    """First ``keep`` items of an RSS feed, each reduced to its headline fields."""
    root = ElementTree.fromstring(body)
    dropped: set[str] = set()
    for channel in root.iter("channel"):
        for index, item in enumerate(channel.findall("item")):
            if index >= keep:
                channel.remove(item)
                continue
            for child in list(item):
                if child.tag not in FEED_ITEM_FIELDS:
                    dropped.add(child.tag)
                    item.remove(child)
        for child in list(channel):
            if child.tag not in ("title", "link", "item", "language"):
                channel.remove(child)
    xml = "\n".join(line.rstrip() for line in tostring(root, encoding="unicode").splitlines())
    return f'<?xml version="1.0" encoding="UTF-8"?>\n{xml}\n', sorted(dropped)


def record_feed(key: str, root: Path) -> Path:
    feed = next(f for f in FEEDS if f.key == key)
    client = HttpClient(feed.key, feed.base_url)
    try:
        body = client.get_text(feed.path, accept=ACCEPT)
    finally:
        client.close()
    body, dropped = trim_feed(body)
    file = fixture_path(root, f"feeds/{feed.key}", feed.path, {}, ".xml")
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(body, encoding="utf-8")
    meta = {
        "provider": f"feeds/{feed.key}",
        "url": f"{feed.base_url}/{feed.path}",
        "recorded_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "sha256": hashlib.sha256(body.encode()).hexdigest(),
        "bytes": len(body.encode()),
        "dropped_fields": dropped,
        "items_kept": FEED_ITEMS_KEPT,
    }
    file.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    return file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Record an upstream response as a fixture.")
    parser.add_argument("provider", choices=[*sorted(PROVIDERS), "feeds"])
    parser.add_argument(
        "path", help="request path relative to the provider base URL (feeds: the feed key)"
    )
    parser.add_argument("params", nargs="*", help="query parameters as key=value")
    parser.add_argument("--root", type=Path, default=FIXTURES_ROOT)
    args = parser.parse_args(argv)
    if args.provider == "feeds":
        file = record_feed(args.path, args.root)
    else:
        params = dict(p.split("=", 1) for p in args.params)
        file = record(args.provider, args.path, params, args.root)
    sys.stdout.write(f"{file}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
