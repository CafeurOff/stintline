"""``/metrics`` for Prometheus, answered only to the server itself (ADR 0027).

Prometheus scrapes the API on its loopback port. Requests through the public site carry the
visitor's address (uvicorn ``--proxy-headers``), so they are refused here as well as by nginx.
With several uvicorn workers, ``PROMETHEUS_MULTIPROC_DIR`` merges their request metrics.
"""

from __future__ import annotations

import ipaddress
import os
from functools import cache

from django.http import Http404, HttpRequest, HttpResponse
from prometheus_client import CONTENT_TYPE_LATEST, REGISTRY, CollectorRegistry, generate_latest
from prometheus_client.multiprocess import MultiProcessCollector

from stintline.core.metrics import StintlineCollector


def _is_loopback(address: str) -> bool:
    try:
        return ipaddress.ip_address(address).is_loopback
    except ValueError:
        return False


@cache
def _registry() -> CollectorRegistry:
    """Built once per process: the multiprocess files are read again on every collect."""
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        MultiProcessCollector(registry)  # type: ignore[no-untyped-call]  # untyped upstream
    else:
        registry = REGISTRY
    registry.register(StintlineCollector())
    return registry


def metrics(request: HttpRequest) -> HttpResponse:
    if not _is_loopback(request.META.get("REMOTE_ADDR", "")):
        raise Http404
    return HttpResponse(generate_latest(_registry()), content_type=CONTENT_TYPE_LATEST)
