"""FIA event documents: the lists on fia.com, the PDFs and the stewards' decisions in them.

fia.com lists the documents of each Grand Prix on a season page (event names) and one page
per event (``…/event/<name>``). Each document is a row with a PDF link, "Doc N - Title" and
"Published on DD.MM.YY HH:MM CET". The lists are parsed with the standard library; the PDF
text with ``pypdf``. robots.txt asks for 10 s between requests (``config.FIA``). PDFs are
only read, never kept by ``racedata`` (ADR 0018).
"""

from __future__ import annotations

import io
import re
from collections.abc import Mapping
from datetime import date, datetime
from html.parser import HTMLParser
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

import structlog
from pydantic import ValidationError
from pypdf import PdfReader
from pypdf.errors import PyPdfError

from racedata.config import FIA_SEASON_PAGES
from racedata.errors import InvalidPayloadError, ProviderError
from racedata.http import HttpClient
from racedata.models import (
    FiaCategory,
    FiaDocumentRef,
    Penalty,
    StewardsDecisionRecord,
)

PROVIDER = "fia"
PDF_PREFIX = "/system/files/decision-document/"
"""Only PDFs under this path are fetched: the relay can never become an open proxy."""
PUBLISHED_TZ = ZoneInfo("Europe/Paris")
"""fia.com labels every time "CET" but shows Paris wall-clock time (CEST in summer): the
publication of a Sunday-evening decision matches the time printed in the PDF."""
MAX_PDF_PAGES = 30
"""Longer PDFs (regulations, entry lists) are cut: the first pages hold what search needs."""

log = structlog.get_logger(__name__)

_DOC = re.compile(r"^\s*Doc\s+(\d+)\s*-\s*(.+?)\s*$", re.S)
_DATE = re.compile(r"(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})")
_CARS = re.compile(r"\bCars?\s+((?:\d{1,2}\s*(?:,|&|and)\s*)*\d{1,2})\b", re.I)
_NUMBER = re.compile(r"\d{1,2}")
_SPACES = re.compile(r"\s+")

# Keywords in order: the first match wins ("Decision - … Times" is a decision).
_CATEGORIES: tuple[tuple[FiaCategory, tuple[str, ...]], ...] = (
    (FiaCategory.DECISION, ("decision",)),
    (FiaCategory.INFRINGEMENT, ("infringement", "offence")),
    (FiaCategory.SUMMONS, ("summons",)),
    (
        FiaCategory.NOTES,
        (
            "event notes",
            "race director",
            "notes",
            "procedure",
            "curfew",
            "entry list",
            "schedule",
            "timetable",
        ),
    ),
    (
        FiaCategory.CLASSIFICATION,
        ("classification", "championship points", "starting grid", "lap times", "times"),
    ),
    (
        FiaCategory.TECHNICAL,
        (
            "scrutineering",
            "technical",
            "parc ferm",
            "power unit",
            "car presentation",
            "tyre",
            "pu element",
            "checks",
        ),
    ),
)


def category_of(title: str) -> FiaCategory:
    lowered = title.lower()
    for category, words in _CATEGORIES:
        if any(word in lowered for word in words):
            return category
    return FiaCategory.OTHER


def cars_in(title: str) -> tuple[int, ...]:
    """Car numbers named in a title: "Car 63", "Cars 4 & 63", "Cars 1, 16 and 44"."""
    found: list[int] = []
    for match in _CARS.finditer(title):
        found += [int(n) for n in _NUMBER.findall(match.group(1)) if int(n) not in found]
    return tuple(found)


def parse_published(text: str) -> datetime | None:
    """``13.09.25 14:35`` (Paris time) in UTC."""
    match = _DATE.search(text)
    if match is None:
        return None
    day, month, year, hour, minute = (int(x) for x in match.groups())
    try:
        local = datetime(2000 + year, month, day, hour, minute, tzinfo=PUBLISHED_TZ)
    except ValueError:
        return None
    return local.astimezone(ZoneInfo("UTC"))


class _ListParser(HTMLParser):
    """Collects event titles and document rows (link, title, date) from a list page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.events: list[str] = []
        self.rows: list[tuple[str | None, str, str]] = []
        self._event_depth: int | None = None
        self._event_text: list[str] = []
        self._in_row = False
        self._row_href: str | None = None
        self._row_title: list[str] = []
        self._row_date: list[str] = []
        self._title_depth: int | None = None
        self._date_open = False
        self._depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self._depth += 1
        classes = (dict(attrs).get("class") or "").split()
        if "event-title" in classes:
            self._event_depth, self._event_text = self._depth, []
        if tag == "li" and "document-row" in classes:
            self._in_row, self._row_href, self._row_title, self._row_date = True, None, [], []
        if not self._in_row:
            return
        href = dict(attrs).get("href")
        if tag == "a" and href and href.lower().endswith(".pdf"):
            self._row_href = href
        if "title" in classes and self._title_depth is None:
            self._title_depth = self._depth
        if "date-display-single" in classes:
            self._date_open = True

    def handle_endtag(self, tag: str) -> None:
        if self._event_depth is not None and self._depth == self._event_depth:
            name = _SPACES.sub(" ", "".join(self._event_text)).strip()
            if name:
                self.events.append(name)
            self._event_depth = None
        if self._title_depth is not None and self._depth == self._title_depth:
            self._title_depth = None
        if tag == "span":
            self._date_open = False
        if tag == "li" and self._in_row:
            title = _SPACES.sub(" ", "".join(self._row_title)).strip()
            self.rows.append((self._row_href, title, "".join(self._row_date).strip()))
            self._in_row = False
        self._depth -= 1

    def handle_data(self, data: str) -> None:
        if self._event_depth is not None:
            self._event_text.append(data)
        if self._title_depth is not None:
            self._row_title.append(data)
        if self._date_open:
            self._row_date.append(data)


def _parse(html: str) -> _ListParser:
    parser = _ListParser()
    parser.feed(html)
    parser.close()
    return parser


def parse_event_names(html: str) -> list[str]:
    """Grand Prix names of a season page, in page order, without duplicates."""
    seen: list[str] = []
    for name in _parse(html).events:
        if name not in seen:
            seen.append(name)
    return seen


def parse_documents(html: str, event_name: str) -> list[FiaDocumentRef]:
    """Documents of an event page. Recalled documents (no PDF link) are skipped."""
    out: list[FiaDocumentRef] = []
    for href, raw_title, raw_date in _parse(html).rows:
        match = _DOC.match(raw_title)
        published = parse_published(raw_date)
        if href is None or match is None or published is None:
            continue
        number, title = int(match.group(1)), match.group(2)
        path = urlsplit(href).path
        try:
            out.append(
                FiaDocumentRef(
                    event_name=event_name,
                    number=number,
                    title=title,
                    category=category_of(title),
                    published_at=published,
                    url=f"https://www.fia.com{path}",
                    cars=cars_in(title),
                )
            )
        except ValidationError:
            continue
    return out


def pdf_text(content: bytes, source: str = PROVIDER) -> str:
    """Text of a PDF, page after page (at most ``MAX_PDF_PAGES``).

    Raises:
        InvalidPayloadError: the bytes are not a readable PDF.
    """
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages[:MAX_PDF_PAGES]]
    except (PyPdfError, ValueError, KeyError, TypeError) as exc:
        raise InvalidPayloadError(source, "document is not a readable PDF") from exc
    # PDF generators often space words with no-break spaces: plain spaces read and search
    # the same way.
    return "\n".join(pages).replace("\xa0", " ").replace("\u202f", " ").strip()


# --------------------------------------------------------------------- decisions

_LABELS = (
    ("No / Driver", "driver"),
    ("Competitor", "competitor"),
    ("Time", "time"),
    ("Session", "session"),
    ("Fact", "fact"),
    ("Infringement", "infringement"),
    ("Offence", "infringement"),
    ("Decision", "decision"),
    ("Reason", "reason"),
)
_END_OF_REASON = ("Competitors are reminded", "Decisions of the Stewards are taken")
_DASHES = str.maketrans({"\u2013": "-", "\u2011": "-", "\u2014": "-"})
"""En dash, no-break hyphen and em dash read as a plain hyphen."""
_DRIVER = re.compile(r"^\s*(\d{1,2})\s*-\s*(.+?)\s*$")
_CLOCK = re.compile(r"\b(\d{1,2}:\d{2})\b")
_HEADER = re.compile(
    r"^Date\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*$\s*^Time\s+(\d{1,2}:\d{2})", re.M
)
_MONTHS = {
    name: index
    for index, name in enumerate(
        (
            "january",
            "february",
            "march",
            "april",
            "may",
            "june",
            "july",
            "august",
            "september",
            "october",
            "november",
            "december",
        ),
        start=1,
    )
}


def _header(text: str) -> tuple[date | None, str | None]:
    """Local date and time the decision was issued (``Date 31 August 2025`` / ``Time 20:23``)."""
    match = _HEADER.search(text)
    if match is None:
        return None, None
    day, month_name, year, clock = match.groups()
    month = _MONTHS.get(month_name.lower())
    if month is None:
        return None, clock
    try:
        return date(int(year), month, int(day)), clock
    except ValueError:
        return None, clock


def _fields(text: str) -> dict[str, str]:
    fields: dict[str, list[str]] = {}
    current: str | None = None
    started = False
    for raw in text.splitlines():
        line = raw.strip()
        if any(line.startswith(stop) for stop in _END_OF_REASON):
            break
        label = next(
            ((key, name) for key, name in _LABELS if line == key or line.startswith(key + " ")),
            None,
        )
        if label is not None and (started or label[1] == "driver"):
            started = True
            current = label[1]
            fields.setdefault(current, []).append(line[len(label[0]) :].strip())
        elif current is not None and line:
            fields[current].append(line)
    return {key: _SPACES.sub(" ", " ".join(parts)).strip() for key, parts in fields.items()}


def _int(pattern: str, text: str) -> int:
    match = re.search(pattern, text)
    return int(match.group(1)) if match else 0


def parse_penalty(decision: str) -> Penalty:
    """What a decision imposes. Unrecognised wording leaves every field empty."""
    text = decision.lower().translate(_DASHES)
    stop_go = _int(r"(\d+)\s*-?\s*seconds?\s+stop\s*(?:and|&|/|-)\s*go", text)
    fine = re.search(r"(?:fine of|€|eur(?:os)?)\s*€?\s*([\d][\d,.\s]*\d)", text)
    return Penalty(
        time_s=0 if stop_go else _int(r"(\d+)\s*-?\s*seconds?\s+(?:time\s+)?penalty", text),
        drive_through="drive through" in text or "drive-through" in text,
        stop_go_s=stop_go,
        grid_places=_int(
            r"(?:drop of\s*)?(\d+)\s*(?:-\s*)?(?:place\s+)?grid\s+(?:place|position)", text
        )
        or _int(r"(\d+)\s*-?\s*place\s+grid", text),
        back_of_grid="back of the grid" in text,
        pit_lane_start="from the pit lane" in text,
        penalty_points=_int(r"(\d+)\s*penalty points?", text),
        reprimand="reprimand" in text,
        fine_eur=int(re.sub(r"\D", "", fine.group(1))) if fine else 0,
        disqualified="disqualif" in text,
        lap_time_deleted="deleted" in text and "lap time" in text,
        no_further_action="no further action" in text,
    )


def parse_decision(text: str) -> StewardsDecisionRecord | None:
    """The fields of a stewards' decision about one car; ``None`` for other documents
    (team-level decisions, summons, notes)."""
    fields = _fields(text)
    driver = _DRIVER.match(fields.get("driver", "").translate(_DASHES))
    if driver is None or "decision" not in fields:
        return None
    clock = _CLOCK.search(fields.get("time", ""))
    issued_on, issued_time = _header(text)
    return StewardsDecisionRecord(
        car=int(driver.group(1)),
        driver_name=driver.group(2),
        competitor=fields.get("competitor", ""),
        incident_time=clock.group(1) if clock else None,
        session=fields.get("session", ""),
        fact=fields.get("fact", ""),
        infringement=fields.get("infringement", ""),
        decision=fields["decision"],
        reason=fields.get("reason", ""),
        penalty=parse_penalty(fields["decision"]),
        issued_on=issued_on,
        issued_time=issued_time,
    )


# ------------------------------------------------------------------------ source


class FiaSource:
    """Document lists and PDFs of fia.com (one request per 10 s, ``config.FIA``)."""

    def __init__(
        self, client: HttpClient, season_pages: Mapping[int, str] = FIA_SEASON_PAGES
    ) -> None:
        self._client = client
        self._pages = season_pages

    @property
    def seasons(self) -> list[int]:
        return sorted(self._pages)

    def _season_page(self, season: int) -> str:
        page = self._pages.get(season)
        if page is None:
            raise ProviderError(PROVIDER, f"no document page known for season {season}")
        return page

    def season_event_names(self, season: int) -> list[str]:
        html = self._client.get_text(self._season_page(season), accept="text/html")
        return parse_event_names(html)

    def event_documents(self, season: int, event_name: str) -> list[FiaDocumentRef]:
        html = self._client.get_text(
            f"{self._season_page(season)}/event/{event_name}", accept="text/html"
        )
        documents = parse_documents(html, event_name)
        log.info("fia_event_listed", season=season, event_name=event_name, documents=len(documents))
        return documents

    def document_pdf(self, url: str) -> bytes:
        """The PDF of a listed document.

        Raises:
            ProviderError: the URL is not an fia.com document PDF.
        """
        parts = urlsplit(url)
        if parts.netloc not in ("", "www.fia.com") or not (
            parts.path.startswith(PDF_PREFIX) and parts.path.lower().endswith(".pdf")
        ):
            raise ProviderError(PROVIDER, "not an FIA document URL")
        return self._client.get_bytes(parts.path, accept="application/pdf")
