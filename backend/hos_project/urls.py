from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def healthz(_request):
    return JsonResponse({"ok": True})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("healthz", healthz),
    path("api/v1/", include("apps.trips.urls")),
    path("api/v1/", include("apps.logs.urls")),
    path("api/v1/", include("apps.routing.urls")),
]
