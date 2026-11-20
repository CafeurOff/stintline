"""The web app's index.html with the head of one page (ADR 0025).

The built index.html (hashed script and style names) is read once per change on disk. Its
`<title>`, description and language are replaced, and the canonical address, language
alternates, link-preview tags and structured data are added before `</head>`.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from functools import lru_cache
from html import escape
from pathlib import Path
from typing import Any

from django.conf import settings

from stintline.seo.pages import SITE_NAME, Locale, PageMeta

FRENCH_PREFIX = "/fr"
_TITLE = re.compile(r"<title>.*?</title>", re.S)
_DESCRIPTION = re.compile(r'<meta\s+name="description"[^>]*>', re.S)
_LANG = re.compile(r'<html lang="[a-z]+"')

FALLBACK_INDEX = """<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><title>StintLine</title>
<meta name="description" content="" /></head><body><div id="root"></div></body></html>
"""
"""Used when the web build is absent (API-only development): the head is still testable."""


@lru_cache(maxsize=4)
def _read(path: str, mtime: float) -> str:
    del mtime  # part of the cache key: a new build is read again
    return Path(path).read_text(encoding="utf-8")


def index_html() -> str:
    path = Path(settings.SPA_INDEX_PATH)
    try:
        return _read(str(path), path.stat().st_mtime)
    except FileNotFoundError:
        return FALLBACK_INDEX


# Page modules of `apps/web/src/app/router.tsx`, by path without the language prefix.
_FEATURES = "src/features"
PAGE_MODULES: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pattern), f"{_FEATURES}/{module}.tsx")
    for pattern, module in (
        (r"live", "live/components/LivePage"),
        (r"news", "news/components/NewsPage"),
        (r"news/\d+", "news/components/ReportPage"),
        (r"calendar(/\d{4})?", "calendar/components/CalendarPage"),
        (r"events/\d+", "event/components/EventPage"),
        (r"drivers", "drivers/components/DriversPage"),
        (r"drivers/[\w-]+", "drivers/components/DriverPage"),
        (r"teams", "teams/components/TeamsPage"),
        (r"teams/[\w-]+", "teams/components/TeamPage"),
        (r"standings(/\d{4})?", "standings/components/StandingsPage"),
        (r"sessions/\d+", "race/components/RacePage"),
        (r"sessions/\d+/tyres", "tyres/components/TyresPage"),
        (r"analysis", "analysis/components/HeadToHeadPage"),
        (r"analysis/pace", "analysis/components/PacePage"),
        (r"analysis/consistency", "analysis/components/ConsistencyPage"),
        (r"analysis/pit-stops", "analysis/components/PitStopsPage"),
        (r"circuits(/[\w-]+)?", "analysis/components/CircuitsPage"),
        (r"documents", "paddock/components/DocumentsPage"),
        (r"technical", "technical/components/TechnicalPage"),
        (r"model", "model/components/ModelPage"),
        (r"about", "about/components/AboutPage"),
    )
)
"""The home and not-found pages are in the main chunk."""


@lru_cache(maxsize=4)
def _read_manifest(path: str, mtime: float) -> dict[str, Any]:
    del mtime
    manifest: dict[str, Any] = json.loads(Path(path).read_text(encoding="utf-8"))
    return manifest


def module_files(bare: str) -> list[str]:
    """Files of the page's chunk and the chunks it imports, as `/assets/...` paths. Empty
    without a build manifest or for pages in the main chunk."""
    module = next((m for pattern, m in PAGE_MODULES if pattern.fullmatch(bare)), None)
    path = Path(settings.SPA_INDEX_PATH).parent / ".vite" / "manifest.json"
    if module is None:
        return []
    try:
        manifest = _read_manifest(str(path), path.stat().st_mtime)
    except FileNotFoundError:
        return []
    files: list[str] = []
    pending = [module]
    seen: set[str] = set()
    while pending:
        key = pending.pop(0)
        chunk = manifest.get(key)
        if key in seen or chunk is None or chunk.get("isEntry"):
            continue  # the entry chunk is already in the page
        seen.add(key)
        files.append(f"/{chunk['file']}")
        pending.extend(chunk.get("imports", []))
    return files


def split_locale(path: str) -> tuple[Locale, str]:
    """`/fr/drivers/norris` → ("fr", "drivers/norris"); `/` → ("en", "")."""
    if path == FRENCH_PREFIX or path.startswith(f"{FRENCH_PREFIX}/"):
        return "fr", path[len(FRENCH_PREFIX) :].strip("/")
    return "en", path.strip("/")


def page_url(origin: str, bare: str, locale: Locale) -> str:
    prefix = FRENCH_PREFIX if locale == "fr" else ""
    return f"{origin}{prefix}/{bare}" if bare else f"{origin}{prefix}/"


def full_title(meta: PageMeta | None, locale: Locale) -> str:
    title = (
        meta.title(locale) if meta else ("Page introuvable" if locale == "fr" else "Page not found")
    )
    return f"{title} · {SITE_NAME}" if title else SITE_NAME


def _attr(value: str) -> str:
    return escape(value, quote=True)


def head_tags(meta: PageMeta, locale: Locale, bare: str, origin: str) -> str:
    title = full_title(meta, locale)
    description = meta.description(locale)
    url = page_url(origin, bare, locale)
    english = _attr(page_url(origin, bare, "en"))
    french = _attr(page_url(origin, bare, "fr"))
    tags = [
        f'<link rel="canonical" href="{_attr(url)}" />',
        f'<link rel="alternate" hreflang="en" href="{english}" />',
        f'<link rel="alternate" hreflang="fr" href="{french}" />',
        f'<link rel="alternate" hreflang="x-default" href="{english}" />',
        f'<meta property="og:site_name" content="{SITE_NAME}" />',
        f'<meta property="og:type" content="{_attr(meta.kind)}" />',
        f'<meta property="og:title" content="{_attr(title)}" />',
        f'<meta property="og:description" content="{_attr(description)}" />',
        f'<meta property="og:url" content="{_attr(url)}" />',
        f'<meta property="og:locale" content="{"fr_FR" if locale == "fr" else "en_GB"}" />',
    ]
    tags.append('<meta name="twitter:card" content="summary" />')
    if meta.image_path:
        tags.append(f'<meta property="og:image" content="{_attr(origin + meta.image_path)}" />')
    if meta.json_ld:
        data = {"@context": "https://schema.org", **meta.json_ld, "url": url}
        if "description" not in data:
            data["description"] = description
        # `</` cannot close the script from inside the JSON.
        payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
        tags.append(f'<script type="application/ld+json">{payload}</script>')
    loaded = index_html()
    for file in module_files(bare):
        if file in loaded:
            continue  # already in the page (the framework chunk)
        tags.append(f'<link rel="modulepreload" crossorigin href="{_attr(file)}" />')
    for api_path in meta.preloads:
        tags.append(
            f'<link rel="preload" as="fetch" crossorigin="anonymous" href="{_attr(api_path)}" />'
        )
    return "\n    ".join(tags)


def render(meta: PageMeta | None, locale: Locale, bare: str, origin: str) -> str:
    """index.html for one page; ``meta`` is ``None`` for a page that does not exist."""
    html = index_html()
    title = full_title(meta, locale)
    html = _TITLE.sub(lambda _: f"<title>{escape(title)}</title>", html, count=1)
    html = _LANG.sub(f'<html lang="{locale}"', html, count=1)
    if meta is None:
        robots = '<meta name="robots" content="noindex" />'
        return html.replace("</head>", f"    {robots}\n  </head>", 1)
    description = f'<meta name="description" content="{_attr(meta.description(locale))}" />'
    html = _DESCRIPTION.sub(lambda _: description, html, count=1)
    return html.replace("</head>", f"    {head_tags(meta, locale, bare, origin)}\n  </head>", 1)


_INLINE_SCRIPT = re.compile(
    r"<script(?![^>]*\bsrc=)(?![^>]*application/ld\+json)[^>]*>(.*?)</script>", re.S
)


def content_security_policy(html: str) -> str:
    """The page's policy: our own scripts plus the inline ones of this very document (theme,
    language and dictionary preload), allowed by their hash rather than 'unsafe-inline'.
    Pictures may come from any HTTPS host: official media and news pictures are URL
    references (ADR 0006, 0015)."""
    hashes = " ".join(
        f"'sha256-{base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()}'"
        for body in _INLINE_SCRIPT.findall(html)
    )
    directives = (
        "default-src 'self'",
        f"script-src 'self' {hashes}".rstrip(),
        # React sets style attributes (team colours, positions).
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self'",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    )
    return "; ".join(directives)
