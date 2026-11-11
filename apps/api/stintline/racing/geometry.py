"""Pure geometry helpers for circuit outlines (no Django, no I/O)."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

OUTLINE_BOX = 1000.0
"""Longest side of the normalised drawing, in SVG user units."""
OUTLINE_PADDING = 40.0
"""Margin kept inside the box so car markers and labels at the edge are not clipped."""


@dataclass(frozen=True)
class NormalisedOutline:
    width: int
    height: int
    points: list[list[float]]


def normalise_outline(points: Sequence[Sequence[float]]) -> NormalisedOutline:
    """Scale an outline uniformly into a ``OUTLINE_BOX`` box and flip y for screen axes
    (the feed's y grows upwards, SVG's grows downwards). Aspect ratio is preserved."""
    if len(points) < 2:
        raise ValueError("an outline needs at least two points")
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    span = max(max(xs) - min(xs), max(ys) - min(ys)) or 1.0
    scale = (OUTLINE_BOX - 2 * OUTLINE_PADDING) / span
    min_x, max_y = min(xs), max(ys)
    out = [
        [
            round((x - min_x) * scale + OUTLINE_PADDING, 1),
            round((max_y - y) * scale + OUTLINE_PADDING, 1),
        ]
        for x, y in zip(xs, ys, strict=True)
    ]
    width = round((max(xs) - min_x) * scale + 2 * OUTLINE_PADDING)
    height = round((max_y - min(ys)) * scale + 2 * OUTLINE_PADDING)
    return NormalisedOutline(width=width, height=height, points=out)


CARD_BOX = 100.0
"""Longest side of the small outline drawn on cards, in SVG user units."""
CARD_POINTS = 120
"""Points kept on a card outline: enough for every corner, a few hundred bytes of path."""


def card_path(points: Sequence[Sequence[float]]) -> str:
    """A compact closed SVG path of the outline, centred in a square ``CARD_BOX`` box."""
    shape = normalise_outline(points)
    step = max(1, -(-len(shape.points) // CARD_POINTS))  # ceiling: never more than CARD_POINTS
    kept = shape.points[::step]
    scale = CARD_BOX / OUTLINE_BOX
    dx = (OUTLINE_BOX - shape.width) / 2
    dy = (OUTLINE_BOX - shape.height) / 2
    coords = [f"{(x + dx) * scale:.1f} {(y + dy) * scale:.1f}" for x, y in kept]
    return "M" + " L".join(coords) + " Z"
