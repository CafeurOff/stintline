from django.urls import path

from stintline.live.api import views

app_name = "live"

urlpatterns = [path("live", views.LiveStatusView.as_view(), name="status")]
