"""Web pages rendered with their head, sitemap and robots (ADR 0025)."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone

from stintline.racing.models import DriverPortrait
from stintline.racing.tests.factories import (
    CircuitFactory,
    DriverFactory,
    EventFactory,
    SessionFactory,
    TeamFactory,
)
from stintline.seo import pages
from stintline.seo.document import PAGE_MODULES

pytestmark = pytest.mark.django_db

INDEX = """<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="description"
      content="StintLine: race strategy analysis."
    />
    <title>StintLine</title>
    <script type="module" src="/assets/index-abc.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>
"""


@pytest.fixture(autouse=True)
def _site(settings: Any, tmp_path: Path) -> None:
    index = tmp_path / "index.html"
    index.write_text(INDEX, encoding="utf-8")
    names = tmp_path / "names.json"
    names.write_text(json.dumps({"Hungarian Grand Prix": "Grand Prix de Hongrie"}), "utf-8")
    settings.SPA_INDEX_PATH = str(index)
    settings.EVENT_NAMES_FR_PATH = str(names)
    settings.SITE_URL = "https://stintline.test"
    pages._event_names_fr.cache_clear()
    cache.clear()


def _json_ld(html: str) -> dict[str, Any]:
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html)
    assert match
    data: dict[str, Any] = json.loads(match.group(1))
    return data


def test_home_page_keeps_the_app_and_gets_a_head() -> None:
    response = Client().get("/")

    html = response.content.decode()
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-cache"
    assert "<title>StintLine</title>" in html
    assert '<script type="module" src="/assets/index-abc.js"></script>' in html
    assert '<link rel="canonical" href="https://stintline.test/" />' in html
    assert 'hreflang="fr" href="https://stintline.test/fr/"' in html
    assert html.count('name="description"') == 1
    assert _json_ld(html)["@type"] == "WebSite"


def test_event_page_names_the_grand_prix_in_each_language() -> None:
    circuit = CircuitFactory.create(name="Hungaroring", locality="Budapest", country="Hungary")
    event = EventFactory.create(name="Hungarian Grand Prix", circuit=circuit)
    year = event.season.year

    english = Client().get(f"/events/{event.pk}").content.decode()
    french = Client().get(f"/fr/events/{event.pk}").content.decode()

    assert f"<title>Hungarian Grand Prix {year} · StintLine</title>" in english
    assert f"<title>Grand Prix de Hongrie {year} · StintLine</title>" in french
    assert '<html lang="fr"' in french
    assert f'href="https://stintline.test/fr/events/{event.pk}"' in french
    data = _json_ld(english)
    assert data["@type"] == "SportsEvent"
    assert data["location"]["address"] == "Budapest, Hungary"
    assert f'rel="preload" as="fetch" crossorigin="anonymous" href="/api/v1/events/{event.pk}"' in (
        english
    )


def test_driver_page_is_a_person_with_a_preview_picture() -> None:
    driver = DriverFactory.create(ref="fangio", given_name="Juan Manuel", family_name="Fangio")
    DriverPortrait.objects.create(
        driver=driver,
        image_url="https://upload.wikimedia.org/wikipedia/commons/a.jpg",
        file_page_url="https://commons.wikimedia.org/wiki/File:a.jpg",
        artist="A",
        license="CC BY 4.0",
        fetched_at=timezone.now(),
    )

    html = Client().get("/drivers/fangio").content.decode()

    assert "<title>Juan Manuel Fangio · StintLine</title>" in html
    assert (
        '<meta property="og:image" content="https://stintline.test/api/v1/drivers/fangio/portrait"'
        in html
    )
    assert _json_ld(html)["@type"] == "Person"


@pytest.mark.parametrize(
    "path",
    ["/drivers/nobody", "/events/999999", "/teams/nobody", "/circuits/nowhere", "/nope"],
)
def test_unknown_pages_answer_404_with_the_app(path: str) -> None:
    response = Client().get(path)

    html = response.content.decode()
    assert response.status_code == 404
    assert '<div id="root"></div>' in html
    assert '<meta name="robots" content="noindex" />' in html
    assert "<title>Page not found · StintLine</title>" in html


@pytest.mark.parametrize(
    "path",
    [
        "/calendar/2025",
        "/standings/2025",
        "/fr/standings",
        "/analysis/pace",
        "/model",
        "/live",
        "/news",
    ],
)
def test_static_and_season_pages_exist(path: str) -> None:
    assert Client().get(path).status_code == 200


def test_session_team_circuit_and_report_pages_are_described() -> None:
    session = SessionFactory.create()
    TeamFactory.create(ref="mclaren", name="McLaren")
    CircuitFactory.create(ref="monza", name="Monza")

    for path in (
        f"/sessions/{session.pk}",
        f"/sessions/{session.pk}/tyres",
        f"/news/{session.pk}",
        "/teams/mclaren",
        "/circuits/monza",
    ):
        assert Client().get(path).status_code == 200, path


def test_values_are_escaped_in_the_head() -> None:
    DriverFactory.create(ref="x", given_name='A "B"', family_name="</script><b>")

    html = Client().get("/drivers/x").content.decode()

    assert "</script><b>" not in html
    assert "&quot;B&quot;" in html


def test_sitemap_lists_pages_in_both_languages() -> None:
    event = EventFactory.create()
    DriverFactory.create(ref="fangio")

    response = Client().get("/sitemap.xml")

    xml = response.content.decode()
    assert response["Content-Type"].startswith("application/xml")
    assert "<loc>https://stintline.test/</loc>" in xml
    assert "<loc>https://stintline.test/fr/drivers/fangio</loc>" in xml
    assert f"<loc>https://stintline.test/events/{event.pk}</loc>" in xml
    assert f"<loc>https://stintline.test/calendar/{event.season.year}</loc>" in xml


def test_robots_points_to_the_sitemap() -> None:
    body = Client().get("/robots.txt").content.decode()

    assert "Disallow: /api/" in body
    assert "Sitemap: https://stintline.test/sitemap.xml" in body


def test_api_paths_are_not_pages() -> None:
    response = Client().get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert b'<div id="root">' not in response.content


def test_missing_build_falls_back_to_a_bare_document(settings: Any) -> None:
    settings.SPA_INDEX_PATH = "/nonexistent/index.html"

    html = Client().get("/model").content.decode()

    assert "<title>How it works · StintLine</title>" in html


def test_page_chunks_are_preloaded_from_the_build_manifest(settings: Any, tmp_path: Path) -> None:
    index = Path(settings.SPA_INDEX_PATH)
    index.write_text(
        INDEX.replace(
            "</head>", '<link rel="modulepreload" href="/assets/framework-1.js">\n</head>'
        ),
        encoding="utf-8",
    )
    (index.parent / ".vite").mkdir()
    (index.parent / ".vite" / "manifest.json").write_text(
        json.dumps(
            {
                "index.html": {"file": "assets/index-abc.js", "isEntry": True},
                "_framework-1.js": {"file": "assets/framework-1.js"},
                "_chart-2.js": {"file": "assets/chart-2.js", "imports": ["_framework-1.js"]},
                "src/features/analysis/components/PacePage.tsx": {
                    "file": "assets/PacePage-3.js",
                    "imports": ["index.html", "_framework-1.js", "_chart-2.js"],
                },
            }
        ),
        encoding="utf-8",
    )

    html = Client().get("/analysis/pace").content.decode()
    home = Client().get("/").content.decode()

    assert '<link rel="modulepreload" crossorigin href="/assets/PacePage-3.js" />' in html
    assert '<link rel="modulepreload" crossorigin href="/assets/chart-2.js" />' in html
    assert html.count("framework-1.js") == 1
    assert "PacePage" not in home


def test_every_page_module_exists_in_the_web_app() -> None:
    root = Path(__file__).resolve().parents[5] / "apps" / "web"

    missing = [module for _, module in PAGE_MODULES if not (root / module).exists()]

    assert missing == []


def test_pages_allow_their_own_inline_scripts_by_hash(settings: Any) -> None:
    Path(settings.SPA_INDEX_PATH).write_text(
        INDEX.replace("</head>", "<script>var a = 1;</script>\n</head>"), encoding="utf-8"
    )

    response = Client().get("/model")

    policy = response["Content-Security-Policy"]
    assert "script-src 'self' 'sha256-" in policy
    assert "'unsafe-inline'" not in policy.split("script-src")[1].split(";")[0]
    assert "frame-ancestors 'none'" in policy
    # One hash: the inline script, not the module script nor the JSON-LD block.
    assert policy.count("sha256-") == 1
