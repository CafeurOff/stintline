from django.urls import path

from stintline.technical.api import views

app_name = "technical"

urlpatterns = [
    path("technical/upgrades", views.UpgradesView.as_view(), name="upgrades"),
    path("technical/power-units", views.PowerUnitsView.as_view(), name="power-units"),
    path("technical/incidents", views.IncidentsView.as_view(), name="incidents"),
]
