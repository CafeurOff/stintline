from django.urls import path

from stintline.strategy_api.api import views

app_name = "strategy"

urlpatterns = [
    path("sessions/<int:session_id>/laps", views.SessionLapsView.as_view(), name="laps"),
    path(
        "sessions/<int:session_id>/degradation",
        views.SessionDegradationView.as_view(),
        name="degradation",
    ),
    path("sessions/<int:session_id>/pit-loss", views.SessionPitLossView.as_view(), name="pit-loss"),
    path("sessions/<int:session_id>/compare", views.SessionCompareView.as_view(), name="compare"),
    path(
        "sessions/<int:session_id>/simulate/undercut", views.UndercutView.as_view(), name="undercut"
    ),
    path(
        "sessions/<int:session_id>/simulate/pit-exit", views.PitExitView.as_view(), name="pit-exit"
    ),
    path("model", views.ModelCardView.as_view(), name="model"),
]
