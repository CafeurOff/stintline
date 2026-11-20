"""Web pages with their head, sitemap.xml and robots.txt (ADR 0025).

nginx serves files that exist (scripts, styles, pictures) and sends every other path here.
"""

from __future__ import annotations

from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.views.decorators.http import require_GET

from stintline.seo import document, sitemap
from stintline.seo.pages import describe


def _origin(request: HttpRequest) -> str:
    configured: str = settings.SITE_URL
    return configured.rstrip("/") if configured else f"{request.scheme}://{request.get_host()}"


@require_GET
def page(request: HttpRequest) -> HttpResponse:
    locale, bare = document.split_locale(request.path)
    meta = describe(bare)
    html = document.render(meta, locale, bare, _origin(request))
    return HttpResponse(
        html,
        status=200 if meta else 404,
        content_type="text/html; charset=utf-8",
        headers={
            # Small and always fresh: a deploy changes the script names it points to.
            "Cache-Control": "no-cache",
            "Content-Security-Policy": document.content_security_policy(html),
        },
    )


@require_GET
def sitemap_view(request: HttpRequest) -> HttpResponse:
    return HttpResponse(
        sitemap.sitemap_xml(_origin(request)),
        content_type="application/xml; charset=utf-8",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@require_GET
def robots(request: HttpRequest) -> HttpResponse:
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /api/",
        "",
        f"Sitemap: {_origin(request)}/sitemap.xml",
        "",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")
