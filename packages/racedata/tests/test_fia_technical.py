import pytest

from racedata.errors import InvalidPayloadError
from racedata.fixtures import FIXTURES_ROOT
from racedata.models import UpgradeReason
from racedata.providers.fia_technical import (
    _header_columns,
    element_code,
    parse_car_presentation,
    parse_new_pu,
    parse_new_pu_text,
    parse_pu_usage,
    upgrade_reason,
)

DOCS = FIXTURES_ROOT / "fia" / "system" / "files" / "decision-document"


def pdf(name: str) -> bytes:
    return (DOCS / f"2025_hungarian_grand_prix_-_{name}.pdf" / "_.pdf").read_bytes()


def test_car_presentation_lists_upgrades_and_teams_without() -> None:
    upgrades, without = parse_car_presentation(pdf("car_presentation_submissions"))

    assert without == ["McLaren Formula 1 Team"]
    assert [(u.team_name, u.number) for u in upgrades] == [
        ("Red Bull Racing", 1),
        ("Red Bull Racing", 2),
        ("Aston Martin Aramco F1 Team", 1),
        ("Visa Cash App Racing Bulls", 1),
        ("Visa Cash App Racing Bulls", 2),
    ]
    flap = upgrades[0]
    assert flap.component == "Front Wing"
    assert flap.reason is UpgradeReason.PERFORMANCE
    assert flap.reason_detail == "Performance - Local Load"
    assert "flap" in flap.difference.lower()
    assert "Hungaroring" in flap.description
    assert upgrades[1].reason is UpgradeReason.RELIABILITY
    assert upgrades[2].reason is UpgradeReason.CIRCUIT


def test_pu_usage_reads_every_car_by_column() -> None:
    rows = parse_pu_usage(pdf("pu_elements_used_per_driver_up_to_now"))

    assert len(rows) == 20
    piastri = rows[0]
    assert piastri.car == 81
    assert "Piastri" in piastri.label
    assert piastri.used == {
        "ICE": 4,
        "TC": 4,
        "MGU-H": 4,
        "MGU-K": 4,
        "ES": 2,
        "CE": 2,
        "EX": 3,
    }


def test_two_line_header_of_2026_is_merged_by_position() -> None:
    words = [
        {"text": "N°", "x0": 48, "x1": 59, "top": 418},
        {"text": "Driver", "x0": 209, "x1": 238, "top": 418},
        {"text": "ICE", "x0": 303, "x1": 320, "top": 418},
        {"text": "TC", "x0": 334, "x1": 347, "top": 418},
        {"text": "EXH", "x0": 361, "x1": 381, "top": 418},
        {"text": "MGU", "x0": 394, "x1": 417, "top": 412},
        {"text": "-K", "x0": 400, "x1": 411, "top": 424},
        {"text": "ES", "x0": 431, "x1": 444, "top": 418},
        {"text": "PU-", "x0": 459, "x1": 476, "top": 412},
        {"text": "CE", "x0": 461, "x1": 475, "top": 424},
        {"text": "PU-", "x0": 492, "x1": 509, "top": 412},
        {"text": "ANC", "x0": 490, "x1": 511, "top": 424},
        {"text": "4", "x0": 310, "x1": 315, "top": 430},
    ]

    codes = [code for _, code in _header_columns(words)]

    assert codes == ["ICE", "TC", "EX", "MGU-K", "ES", "CE", "ANC"]


def test_header_needs_the_number_column() -> None:
    assert _header_columns([{"text": "Driver", "x0": 0, "x1": 10, "top": 0}]) == []


def test_new_elements_with_allowance_and_shared_statement() -> None:
    changes = parse_new_pu(pdf("new_pu_elements_for_this_competition"))

    assert [(c.car, c.element, c.number, c.allowed, c.compliant) for c in changes] == [
        (23, "ES", 2, 2, True),
        (31, "CE", 2, 2, True),
        (23, "CE", 2, 2, True),
        (27, "CE", 2, 2, True),
    ]


def test_new_exhaust_one_of_the_allowed() -> None:
    [change] = parse_new_pu(pdf("new_pu_elements_for_this_competition_0"))

    assert (change.car, change.element, change.previous, change.number) == (10, "EX", 4, 5)
    assert (change.allowed, change.season, change.compliant) == (8, 2025, True)


def test_element_beyond_the_allowance_is_not_compliant() -> None:
    text = """The following driver will be using a new internal combustion engine (ICE) for the
remainder of the Competition:
Number Car Driver Previously used ICE
41 Racing Bulls RB Ford Arvid Lindblad 6
The internal combustion engine used by Arvid Lindblad is the seventh (7th) of the four (4) new
internal combustion engines allowed for the 2026 Championship season and this is not in
compliance with B8.2.2 a) of the 2026 Formula One Sporting Regulations."""

    [change] = parse_new_pu_text(text)

    assert (change.element, change.number, change.allowed, change.compliant) == (
        "ICE",
        7,
        4,
        False,
    )


def test_row_without_statement_keeps_the_count() -> None:
    text = "will be using a new turbocharger (TC) for the remainder\n44 Ferrari Lewis Hamilton 3"

    [change] = parse_new_pu_text(text)

    assert (change.number, change.allowed, change.compliant) == (4, None, None)


@pytest.mark.parametrize(
    ("text", "reason"),
    [
        ("Performance - Local Load", UpgradeReason.PERFORMANCE),
        ("Circuit specific - Cooling Range", UpgradeReason.CIRCUIT),
        ("Reliability", UpgradeReason.RELIABILITY),
        ("Homologation", UpgradeReason.OTHER),
    ],
)
def test_upgrade_reason(text: str, reason: UpgradeReason) -> None:
    assert upgrade_reason(text) is reason


@pytest.mark.parametrize(
    ("name", "code"),
    [
        ("PU-CE", "CE"),
        ("EXH", "EX"),
        ("energy store unit", "ES"),
        ("Motor Generator Unit - Kinetic", "MGU-K"),
        ("power unit ancillary component", "ANC"),
        ("wings", None),
    ],
)
def test_element_code(name: str, code: str | None) -> None:
    assert element_code(name) == code


def test_unreadable_pdf() -> None:
    with pytest.raises(InvalidPayloadError):
        parse_pu_usage(b"not a pdf")
