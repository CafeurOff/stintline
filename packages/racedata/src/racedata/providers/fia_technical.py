"""Technical documents of a Grand Prix: car upgrades and power-unit elements (ADR 0019).

* "Car Presentation Submissions": one page per team, a table of updated components (number,
  component, primary reason, geometric difference, description) or "No updates submitted".
* "PU elements used per driver up to now": one row per car, one column per element. The
  header can sit on two lines ("MGU / -K"), so columns are placed by their x position.
* "New PU elements for this Competition": which car takes which new element, the count, the
  season's allowance and whether it complies with the regulations.

Tables are read with ``pdfplumber`` (words and cells with positions); pages without text
(pictures of the parts) are skipped. Only facts printed in the documents are returned.
"""

from __future__ import annotations

import io
import re
from collections.abc import Iterable
from typing import Any

import pdfplumber
from pdfminer.pdfparser import PDFSyntaxError
from pdfplumber.utils.exceptions import PdfminerException

from racedata.errors import InvalidPayloadError
from racedata.models import CarUpgradeRecord, PuChangeRecord, PuUsageRecord, UpgradeReason

PROVIDER = "fia"
NO_UPDATES = "no updates"
_SPACES = re.compile(r"\s+")
_DASHES = str.maketrans({chr(0x2013): "-", chr(0x2014): "-", chr(0x2011): "-"})
"""En dash, em dash and no-break hyphen read as a plain hyphen."""

ELEMENT_ALIASES: dict[str, str] = {
    "ICE": "ICE",
    "TC": "TC",
    "MGU-H": "MGU-H",
    "MGU-K": "MGU-K",
    "ES": "ES",
    "CE": "CE",
    "PU-CE": "CE",
    "EX": "EX",
    "EXH": "EX",
    "PU-ANC": "ANC",
    "ANC": "ANC",
}
"""Element codes across regulation years: 2026 renamed CE to PU-CE and EX to EXH, dropped
MGU-H and added PU-ANC (power unit ancillary component)."""

_ELEMENT_NAMES: tuple[tuple[str, str], ...] = (
    ("internal combustion engine", "ICE"),
    ("turbocharger", "TC"),
    ("turbo charger", "TC"),
    ("motor generator unit - heat", "MGU-H"),
    ("mgu-h", "MGU-H"),
    ("motor generator unit - kinetic", "MGU-K"),
    ("mgu-k", "MGU-K"),
    ("energy store", "ES"),
    ("control electronics", "CE"),
    ("exhaust", "EX"),
    ("ancillary", "ANC"),
)


def _clean(text: str | None) -> str:
    return _SPACES.sub(" ", (text or "").translate(_DASHES)).strip()


def _open(content: bytes) -> Any:
    try:
        return pdfplumber.open(io.BytesIO(content))
    except (PdfminerException, PDFSyntaxError, ValueError, KeyError, TypeError) as exc:
        raise InvalidPayloadError(PROVIDER, "document is not a readable PDF") from exc


# ---------------------------------------------------------------------- upgrades


def upgrade_reason(text: str) -> UpgradeReason:
    lowered = text.lower()
    if lowered.startswith("performance"):
        return UpgradeReason.PERFORMANCE
    if lowered.startswith("circuit"):
        return UpgradeReason.CIRCUIT
    if lowered.startswith("reliability"):
        return UpgradeReason.RELIABILITY
    return UpgradeReason.OTHER


def _team_of(lines: list[str]) -> str | None:
    """The team named under the "Car Presentation - <event>" title (asterisks removed)."""
    for index, line in enumerate(lines):
        if line.lower().startswith("car presentation") and index + 1 < len(lines):
            return _clean(lines[index + 1].strip("* ")) or None
    return None


def _rows(tables: Iterable[list[list[str | None]]]) -> list[list[str]]:
    """Upgrade rows: a number starts an item; a row that only fills the description column
    of the same table continues it. Fragments from other tables are ignored."""
    items: list[list[str]] = []
    for table in tables:
        description_column: int | None = None
        for raw in table:
            filled = [i for i, c in enumerate(raw) if c and c.strip()]
            if not filled:
                continue
            cells = [_clean(raw[i]) for i in filled]
            if cells[0].isdigit() and len(cells) >= 3:
                items.append(cells)
                description_column = filled[-1]
            elif description_column is not None and filled == [description_column]:
                items[-1][-1] = f"{items[-1][-1]} {cells[0]}"
    return items


def parse_car_presentation(content: bytes) -> tuple[list[CarUpgradeRecord], list[str]]:
    """Upgrades of every team, and the teams that declared none."""
    upgrades: list[CarUpgradeRecord] = []
    without: list[str] = []
    with _open(content) as pdf:
        for page in pdf.pages:
            lines = (page.extract_text() or "").splitlines()
            team = _team_of(lines)
            if team is None:
                continue
            if any(NO_UPDATES in line.lower() for line in lines):
                without.append(team)
                continue
            for cells in _rows(page.extract_tables()):
                number, component, *rest = cells
                reason = rest[0] if rest else ""
                difference = rest[1] if len(rest) > 2 else ""
                description = rest[-1] if len(rest) > 1 else ""
                upgrades.append(
                    CarUpgradeRecord(
                        team_name=team,
                        number=int(number),
                        component=component,
                        reason=upgrade_reason(reason),
                        reason_detail=reason,
                        difference=difference,
                        description=description,
                    )
                )
    return upgrades, without


# ------------------------------------------------------------------- PU usage


HEADER_SPAN_PT = 14
"""Vertical reach of the header around "Driver": two-line codes ("MGU" over "-K")."""


def _header_columns(words: list[dict[str, Any]]) -> list[tuple[float, str]]:
    """``(x centre, element code)`` of the usage table header, merging codes split over two
    lines ("MGU" above "-K", "PU-" above "CE") by horizontal overlap."""
    numbers = [w for w in words if w["text"].rstrip("°º.").upper() in ("N", "NO", "NUMBER")]
    anchor = next(
        (
            w
            for w in words
            if w["text"] == "Driver" and any(abs(n["top"] - w["top"]) <= 3 for n in numbers)
        ),
        None,
    )
    if anchor is None:
        return []
    near = [
        w
        for w in words
        if abs(w["top"] - anchor["top"]) <= HEADER_SPAN_PT
        and w["x0"] > anchor["x1"] + 20
        and not w["text"].isdigit()  # the first row of counts sits just below the header
    ]
    near.sort(key=lambda w: w["x0"])
    merged: list[dict[str, Any]] = []
    for word in near:
        last = merged[-1] if merged else None
        if last is not None and word["x0"] < last["x1"] and last["x0"] < word["x1"]:
            upper, lower = (last, word) if last["top"] <= word["top"] else (word, last)
            joined = upper["text"] + lower["text"]
            merged[-1] = {
                "text": joined,
                "x0": min(last["x0"], word["x0"]),
                "x1": max(last["x1"], word["x1"]),
                "top": upper["top"],
            }
        else:
            merged.append(dict(word))
    out = []
    for word in merged:
        code = ELEMENT_ALIASES.get(word["text"].upper().replace("--", "-"))
        if code is not None:
            out.append(((word["x0"] + word["x1"]) / 2, code))
    return out


_CAR = re.compile(r"^\d{1,2}$")


def parse_pu_usage(content: bytes) -> list[PuUsageRecord]:
    """Elements used so far by each car (the season's running totals)."""
    records: list[PuUsageRecord] = []
    with _open(content) as pdf:
        for page in pdf.pages:
            words = page.extract_words()
            columns = _header_columns(words)
            if not columns:
                continue
            first_x = min(x for x, _ in columns) - 15
            lines: dict[int, list[dict[str, Any]]] = {}
            for word in words:
                lines.setdefault(round(word["top"]), []).append(word)
            for line in lines.values():
                line.sort(key=lambda w: w["x0"])
                if not _CAR.match(line[0]["text"]) or line[0]["x0"] > first_x / 2:
                    continue
                counts: dict[str, int] = {}
                name: list[str] = []
                for word in line[1:]:
                    centre = (word["x0"] + word["x1"]) / 2
                    if word["x0"] >= first_x and word["text"].isdigit():
                        code = min(columns, key=lambda c: abs(c[0] - centre))[1]
                        counts[code] = int(word["text"])
                    elif word["x0"] < first_x:
                        name.append(word["text"])
                if counts:
                    records.append(
                        PuUsageRecord(car=int(line[0]["text"]), label=" ".join(name), used=counts)
                    )
    return records


# ------------------------------------------------------------------ PU changes

_BLOCK = re.compile(r"(?:using|with) an? new (.+?) \(([A-Z-]+)\)", re.I)
_OPENING = re.compile(r"(?:using|with) an? new", re.I)
_ROW = re.compile(r"^(\d{1,2}) (.+) (\d{1,2})$")
_STATEMENT = re.compile(
    r"used by (?P<driver>.+?) is (?:the \w+ \((?P<ordinal>\d+)(?:st|nd|rd|th)\)|one \(1\)) "
    r"of the \w+ \((?P<allowed>\d+)\) new .+? allowed for the (?P<season>\d{4}) "
    r"Championship season and this is (?P<verdict>not in compliance|in conformity|in compliance)",
    re.I,
)


def element_code(name: str) -> str | None:
    lowered = _clean(name).lower()
    upper = lowered.upper()
    if upper in ELEMENT_ALIASES:
        return ELEMENT_ALIASES[upper]
    return next((code for word, code in _ELEMENT_NAMES if word in lowered), None)


def parse_new_pu(content: bytes) -> list[PuChangeRecord]:
    """New elements fitted for the weekend, with the count, allowance and compliance."""
    with _open(content) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    return parse_new_pu_text(text)


def parse_new_pu_text(text: str) -> list[PuChangeRecord]:
    """``parse_new_pu`` on the extracted text."""
    lines = _join_split_sentences([_clean(line) for line in text.splitlines()])
    flat = _clean(text)
    out: list[PuChangeRecord] = []
    element: str | None = None
    for line in lines:
        block = _BLOCK.search(line)
        if block is not None:
            element = element_code(block.group(2)) or element_code(block.group(1))
            continue
        row = _ROW.match(line)
        if row is None or element is None:
            continue
        car, label, previous = int(row.group(1)), row.group(2), int(row.group(3))
        statement = next(
            (
                m
                for m in _STATEMENT.finditer(flat)
                if (m.group("driver") in label or m.group("driver").lower().startswith("the above"))
                and element_code(_element_words(m)) == element
            ),
            None,
        )
        out.append(
            PuChangeRecord(
                car=car,
                label=label,
                element=element,
                previous=previous,
                number=int(statement.group("ordinal"))
                if statement and statement.group("ordinal")
                else previous + 1,
                allowed=int(statement.group("allowed")) if statement else None,
                season=int(statement.group("season")) if statement else None,
                compliant=None
                if statement is None
                else "not" not in statement.group("verdict").lower(),
            )
        )
    return out


def _join_split_sentences(lines: list[str]) -> list[str]:
    """Join "… will be using a new exhaust" with the next line ("system (EX) for …")."""
    out: list[str] = []
    for line in lines:
        if out and _OPENING.search(out[-1]) and _BLOCK.search(out[-1]) is None:
            out[-1] = f"{out[-1]} {line}"
        else:
            out.append(line)
    return out


def _element_words(match: re.Match[str]) -> str:
    """The element named in a statement ("… new internal combustion engines allowed …")."""
    found = re.search(r"new (.+?) allowed", match.group(0), re.I)
    return found.group(1) if found else ""
