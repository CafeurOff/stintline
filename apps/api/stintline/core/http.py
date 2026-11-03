"""HTTP caching helpers for immutable or slowly changing resources."""

from __future__ import annotations

import hashlib
from typing import Any

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

HISTORICAL_MAX_AGE_S = 3600
"""Historical race data only changes when re-ingested: browsers and proxies may cache it
for an hour and then revalidate with the ETag."""


def etag_for(*parts: object) -> str:
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:32]
    return f'"{digest}"'


def cached_response(request: Request, data: Any, *etag_parts: object) -> Response:
    """Return 304 when the client already has this version, else the data with
    ``ETag`` and ``Cache-Control`` headers."""
    etag = etag_for(*etag_parts)
    headers = {"ETag": etag, "Cache-Control": f"public, max-age={HISTORICAL_MAX_AGE_S}"}
    if etag in request.headers.get("If-None-Match", ""):
        return Response(status=status.HTTP_304_NOT_MODIFIED, headers=headers)
    return Response(data, headers=headers)
