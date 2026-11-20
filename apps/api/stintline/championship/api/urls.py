from django.urls import path

from stintline.championship.api import views

urlpatterns = [
    path("seasons/<int:year>/title", views.SeasonTitleView.as_view(), name="season-title"),
]
