from django.urls import path

from stintline.paddock.api import views

app_name = "paddock"

urlpatterns = [
    path("documents", views.DocumentListView.as_view(), name="documents"),
    path("documents/events", views.DocumentEventsView.as_view(), name="document-events"),
    path("documents/<int:document_id>", views.DocumentDetailView.as_view(), name="document"),
    path("documents/<int:document_id>/pdf", views.DocumentPdfView.as_view(), name="pdf"),
    path("stewards/decisions", views.DecisionListView.as_view(), name="decisions"),
]
