from django.urls import path

from stintline.racing.api import views

app_name = "racing"

urlpatterns = [
    path("seasons", views.SeasonListView.as_view(), name="seasons"),
    path("seasons/<int:year>/events", views.SeasonEventListView.as_view(), name="season-events"),
    path("sessions/<int:session_id>", views.SessionDetailView.as_view(), name="session"),
    path(
        "sessions/<int:session_id>/stints", views.SessionStintsView.as_view(), name="session-stints"
    ),
]
