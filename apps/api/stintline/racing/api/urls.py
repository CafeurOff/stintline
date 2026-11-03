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
    path("sessions/<int:session_id>/track", views.SessionTrackView.as_view(), name="session-track"),
    path(
        "sessions/<int:session_id>/sectors",
        views.SessionSectorsView.as_view(),
        name="session-sectors",
    ),
    path("sessions/<int:session_id>/radio", views.SessionRadioView.as_view(), name="session-radio"),
    path(
        "seasons/<int:year>/standings", views.SeasonStandingsView.as_view(), name="season-standings"
    ),
    path(
        "seasons/<int:year>/standings/progression",
        views.SeasonProgressionView.as_view(),
        name="season-progression",
    ),
    path("events/<int:event_id>", views.EventDetailView.as_view(), name="event"),
    path("home", views.HomeView.as_view(), name="home"),
    path("teams", views.TeamListView.as_view(), name="teams"),
    path("teams/<slug:ref>", views.TeamCareerView.as_view(), name="team"),
    path("drivers", views.DriverListView.as_view(), name="drivers"),
    path("drivers/<slug:ref>", views.DriverCareerView.as_view(), name="driver"),
    path("drivers/<slug:ref>/results", views.DriverResultsView.as_view(), name="driver-results"),
]
