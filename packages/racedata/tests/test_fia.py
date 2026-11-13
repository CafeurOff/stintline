from datetime import UTC, date, datetime
from pathlib import Path

import pytest

from racedata.errors import InvalidPayloadError, ProviderError
from racedata.fixtures import FIXTURES_ROOT, fia_suffix
from racedata.models import FiaCategory
from racedata.providers.fia import (
    cars_in,
    category_of,
    parse_decision,
    parse_documents,
    parse_event_names,
    parse_penalty,
    parse_published,
    pdf_text,
)
from racedata.sources import build_fixture_sources

SEASON_2025 = (
    "documents/championships/fia-formula-one-world-championship-14/season/season-2025-2071"
)
FIA = FIXTURES_ROOT / "fia"


def hungary_html() -> str:
    return (FIA / SEASON_2025 / "event" / "Hungarian_Grand_Prix" / "_.html").read_text()


def pdf(name: str) -> bytes:
    return next(FIA.rglob(f"*{name}*/_.pdf")).read_bytes()


def test_season_page_lists_every_grand_prix_once() -> None:
    names = parse_event_names((FIA / SEASON_2025 / "_.html").read_text())

    assert "Hungarian Grand Prix" in names
    assert len(names) == len(set(names))
    assert len(names) >= 24


def test_event_page_lists_documents_with_number_category_and_cars() -> None:
    docs = parse_documents(hungary_html(), "Hungarian Grand Prix")

    erratic = next(d for d in docs if "Erratic" in d.title)
    assert erratic.category is FiaCategory.INFRINGEMENT
    assert erratic.cars == (16,)
    assert erratic.url.startswith("https://www.fia.com/system/files/decision-document/")
    assert erratic.published_at.tzinfo is not None
    assert len({d.url for d in docs}) == len(docs)
    assert {FiaCategory.CLASSIFICATION, FiaCategory.DECISION} <= {d.category for d in docs}


def test_recalled_documents_have_no_link_and_are_skipped() -> None:
    html = """<li class="document-row key-3"><div class="title">Recalled - Doc 3 - Notes</div>
    <span class="date-display-single">01.08.25 10:00</span></li>"""

    assert parse_documents(html, "Hungarian Grand Prix") == []


@pytest.mark.parametrize(
    ("title", "category"),
    [
        ("Decision - Car 1 - Qualifying SC2 - SC1 Times", FiaCategory.DECISION),
        ("Infringement - Car 44 - Pit lane speeding", FiaCategory.INFRINGEMENT),
        ("Offence - Car 4", FiaCategory.INFRINGEMENT),
        ("Summons - Car 63", FiaCategory.SUMMONS),
        ("Event Notes - Pirelli Preview", FiaCategory.NOTES),
        ("Final Race Classification", FiaCategory.CLASSIFICATION),
        ("New PU elements for this Competition", FiaCategory.TECHNICAL),
        ("Stewards Biographies", FiaCategory.OTHER),
    ],
)
def test_category_from_title(title: str, category: FiaCategory) -> None:
    assert category_of(title) is category


def test_cars_named_in_titles() -> None:
    assert cars_in("Summons - Pit Lane Incident between Cars 4 & 63") == (4, 63)
    assert cars_in("Cars 1, 16 and 44 - Track limits") == (1, 16, 44)
    assert cars_in("Championship Points") == ()


def test_published_time_is_paris_time_in_utc() -> None:
    assert parse_published("03.08.25 18:22") == datetime(2025, 8, 3, 16, 22, tzinfo=UTC)
    assert parse_published("07.12.25 17:35") == datetime(2025, 12, 7, 16, 35, tzinfo=UTC)
    assert parse_published("31.02.25 10:00") is None
    assert parse_published("soon") is None


def test_decision_of_a_recorded_infringement() -> None:
    record = parse_decision(pdf_text(pdf("car_16_-_erratic")))

    assert record is not None
    assert (record.car, record.driver_name) == (16, "Charles Leclerc")
    assert record.session == "Race"
    assert record.incident_time == "16:26"
    assert record.issued_on == date(2025, 8, 3)
    assert record.penalty.time_s == 5
    assert record.penalty.penalty_points == 1
    assert "moved twice" in record.fact


def test_classification_is_not_a_decision() -> None:
    assert parse_decision(pdf_text(pdf("final_race_classification"))) is None


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Drive through penalty.", {"drive_through": True}),
        ("10 second stop and go penalty.", {"stop_go_s": 10}),
        ("Drop of 3 grid positions at the next race.", {"grid_places": 3}),
        ("10-place grid penalty for the next race.", {"grid_places": 10}),
        ("Required to start the race from the back of the grid.", {"back_of_grid": True}),
        ("The car must start from the pit lane.", {"pit_lane_start": True}),
        ("Reprimand (driving).", {"reprimand": True}),
        ("A fine of €10,000.", {"fine_eur": 10000}),
        ("Disqualification from the Qualifying session.", {"disqualified": True}),
        ("Lap time deleted.", {"lap_time_deleted": True}),
        ("No further action.", {"no_further_action": True}),
        ("5 second time penalty. 2 penalty points.", {"time_s": 5, "penalty_points": 2}),
    ],
)
def test_penalty_wording(text: str, expected: dict[str, object]) -> None:
    assert parse_penalty(text).model_dump(exclude_defaults=True) == expected


def test_unreadable_pdf_is_an_invalid_payload() -> None:
    with pytest.raises(InvalidPayloadError):
        pdf_text(b"not a pdf")


def test_fixture_source_reads_lists_and_pdfs() -> None:
    sources = build_fixture_sources()
    try:
        assert sources.fia is not None
        assert 2025 in sources.fia.seasons
        assert "Hungarian Grand Prix" in sources.fia.season_event_names(2025)
        docs = sources.fia.event_documents(2025, "Hungarian Grand Prix")
        erratic = next(d for d in docs if "Erratic" in d.title)
        assert sources.fia.document_pdf(erratic.url).startswith(b"%PDF")
    finally:
        sources.close()


def test_source_refuses_foreign_urls_and_unknown_seasons() -> None:
    sources = build_fixture_sources()
    try:
        assert sources.fia is not None
        with pytest.raises(ProviderError):
            sources.fia.document_pdf("https://example.com/system/files/decision-document/x.pdf")
        with pytest.raises(ProviderError):
            sources.fia.document_pdf("https://www.fia.com/etc/passwd")
        with pytest.raises(ProviderError):
            sources.fia.season_event_names(1999)
    finally:
        sources.close()


def test_fixture_suffix_follows_the_path() -> None:
    assert fia_suffix("/system/files/decision-document/x.PDF") == ".pdf"
    assert fia_suffix("documents/x/event/Hungarian Grand Prix") == ".html"


def test_header_without_month_still_reads_the_time() -> None:
    text = (
        "Date 3 Augtober 2025\nTime 18:22\nNo / Driver 16 - Charles Leclerc\n"
        "Session Race\nDecision Reprimand.\n"
    )

    record = parse_decision(text)

    assert record is not None
    assert record.issued_on is None
    assert record.issued_time == "18:22"
    assert record.penalty.reprimand


def test_fixtures_exist_for_every_recorded_pdf() -> None:
    assert any(Path(p).suffix == ".pdf" for p in FIA.rglob("_.pdf"))
