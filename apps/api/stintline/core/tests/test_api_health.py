from unittest.mock import patch

import pytest
from django.db import DatabaseError
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.mark.django_db
def test_health_returns_ok_when_database_reachable(client: APIClient) -> None:
    response = client.get(reverse("core:health"))

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0", "database": "ok"}
    assert response["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_health_returns_503_when_database_unavailable(client: APIClient) -> None:
    with patch("django.db.backends.utils.CursorWrapper.execute", side_effect=DatabaseError):
        response = client.get(reverse("core:health"))

    assert response.status_code == 503
    assert response.json()["database"] == "unavailable"
    assert response.json()["status"] == "unavailable"
