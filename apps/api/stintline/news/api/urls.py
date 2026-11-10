from django.urls import path

from stintline.news.api import views

urlpatterns = [
    path("news/headlines", views.HeadlineListView.as_view(), name="news-headlines"),
    path("news/reports", views.ReportListView.as_view(), name="news-reports"),
    path("news/reports/<int:session_id>", views.ReportDetailView.as_view(), name="news-report"),
]
