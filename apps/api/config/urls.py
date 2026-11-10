"""Root URL configuration. Every public endpoint lives under /api/v1/."""

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("api/v1/", include("stintline.core.api.urls")),
    path("api/v1/", include("stintline.racing.api.urls")),
    path("api/v1/", include("stintline.strategy_api.api.urls")),
    path("api/v1/", include("stintline.live.api.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]

if settings.ADMIN_ENABLED:
    urlpatterns.append(path("admin/", admin.site.urls))
