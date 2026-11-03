"""Uniform error responses. Internal details never reach the client."""

from __future__ import annotations

from typing import Any

import structlog
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

log = structlog.get_logger(__name__)

PROBLEM_TYPE_BASE = "https://github.com/CafeurOff/stintline/blob/main/docs/api-errors.md"


def _problem(status_code: int, code: str, title: str, detail: str, **extra: Any) -> Response:
    body = {
        "type": f"{PROBLEM_TYPE_BASE}#{code}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "code": code,
        **extra,
    }
    return Response(body, status=status_code, content_type="application/problem+json")


def problem_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    """DRF exception handler producing problem-style JSON for every error."""
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    response = exception_handler(exc, context)

    if response is None:
        log.exception("api_unhandled_exception", view=type(context.get("view")).__name__)
        return _problem(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal_error",
            "Internal server error",
            "An unexpected error occurred.",
        )

    assert isinstance(exc, exceptions.APIException)  # noqa: S101  (guaranteed by DRF)
    if isinstance(exc, exceptions.ValidationError):
        errors = exc.detail if isinstance(exc.detail, dict) else {"non_field_errors": exc.detail}
        return _problem(
            response.status_code,
            "invalid",
            "Invalid request",
            "Request validation failed.",
            invalid_params=errors,
        )
    codes = exc.get_codes()
    code = codes if isinstance(codes, str) else "error"
    return _problem(response.status_code, code, str(exc.default_detail), str(exc.detail))
