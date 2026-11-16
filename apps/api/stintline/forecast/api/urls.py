from django.urls import path

from stintline.forecast.api import views

urlpatterns = [
    path("forecasts", views.ForecastListView.as_view(), name="forecasts"),
]
