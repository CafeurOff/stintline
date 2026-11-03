from django.urls import path

from stintline.core.api.views import HealthView

app_name = "core"

urlpatterns = [
    path("health", HealthView.as_view(), name="health"),
]
