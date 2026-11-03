from typing import Any

import pytest
from django.http import Http404
from rest_framework import exceptions

from stintline.core.api.exceptions import problem_exception_handler

CONTEXT: dict[str, Any] = {"view": None}


def test_not_found_is_rendered_as_problem() -> None:
    response = problem_exception_handler(Http404("secret path"), CONTEXT)

    assert response.status_code == 404
    assert response.data["code"] == "not_found"
    assert "secret path" not in str(response.data)
    assert response.data["type"].endswith("#not_found")


def test_validation_error_lists_field_errors() -> None:
    exc = exceptions.ValidationError({"lap": ["Must be positive."]})

    response = problem_exception_handler(exc, CONTEXT)

    assert response.status_code == 400
    assert response.data["code"] == "invalid"
    assert response.data["invalid_params"] == {"lap": ["Must be positive."]}


def test_validation_error_with_list_detail_is_wrapped() -> None:
    response = problem_exception_handler(exceptions.ValidationError(["bad"]), CONTEXT)

    assert response.data["invalid_params"] == {"non_field_errors": ["bad"]}


def test_unhandled_exception_hides_internals() -> None:
    response = problem_exception_handler(RuntimeError("db password is hunter2"), CONTEXT)

    assert response.status_code == 500
    assert response.data["code"] == "internal_error"
    assert "hunter2" not in str(response.data)


@pytest.mark.parametrize(
    ("exc", "status_code", "code"),
    [
        (exceptions.MethodNotAllowed("POST"), 405, "method_not_allowed"),
        (exceptions.Throttled(wait=3), 429, "throttled"),
    ],
)
def test_api_exceptions_keep_status_and_code(
    exc: exceptions.APIException, status_code: int, code: str
) -> None:
    response = problem_exception_handler(exc, CONTEXT)

    assert response.status_code == status_code
    assert response.data["code"] == code
