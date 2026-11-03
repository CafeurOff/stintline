import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_openapi_schema_lists_versioned_endpoints() -> None:
    response = APIClient().get(reverse("schema"), {"format": "json"})

    assert response.status_code == 200
    schema = response.json()
    assert schema["info"]["title"] == "StintLine API"
    assert all(path.startswith("/api/v1/") for path in schema["paths"])
    assert "/api/v1/health" in schema["paths"]
