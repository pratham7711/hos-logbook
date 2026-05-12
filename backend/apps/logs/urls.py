from django.urls import path

from .views import daily_log_pdf, list_daily_logs, trip_pdf

urlpatterns = [
    path("trips/<uuid:trip_id>/logs/", list_daily_logs),
    path("trips/<uuid:trip_id>/logs/<str:log_date>/pdf", daily_log_pdf),
    path("trips/<uuid:trip_id>/logs.pdf", trip_pdf),
]
