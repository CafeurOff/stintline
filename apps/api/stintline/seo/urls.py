from django.urls import path, re_path

from stintline.seo import views

app_name = "seo"

urlpatterns = [
    path("sitemap.xml", views.sitemap_view, name="sitemap"),
    path("robots.txt", views.robots, name="robots"),
    # Last: every path that is not the API, the admin or a file is a web page.
    re_path(r"^(?!api/|ws/|admin/|static/|assets/).*$", views.page, name="page"),
]
