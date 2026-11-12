from django.urls import path

from stintline.analysis.api import views

app_name = "analysis"

urlpatterns = [
    path("analysis/head-to-head", views.HeadToHeadView.as_view(), name="head-to-head"),
    path("analysis/seasons/<int:year>/teammates", views.TeammatesView.as_view(), name="teammates"),
    path(
        "analysis/seasons/<int:year>/consistency",
        views.ConsistencyView.as_view(),
        name="consistency",
    ),
    path("analysis/seasons/<int:year>/pit-stops", views.PitStopsView.as_view(), name="pit-stops"),
    path("analysis/circuits", views.CircuitsView.as_view(), name="circuits"),
    path("sessions/<int:session_id>/pace", views.SessionPaceView.as_view(), name="pace"),
]
