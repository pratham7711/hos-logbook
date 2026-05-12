from datetime import date

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.trips.models import Trip
from apps.trips.serializers import DailyLogSerializer

from .models import DailyLog
from .services.pdf import render_daily_log_pdf, render_trip_pdf


@api_view(["GET"])
def list_daily_logs(request, trip_id):
    trip = get_object_or_404(Trip, pk=trip_id)
    qs = trip.daily_logs.all().prefetch_related("events")
    return Response(DailyLogSerializer(qs, many=True).data)


@api_view(["GET"])
def daily_log_pdf(request, trip_id, log_date):
    trip = get_object_or_404(Trip, pk=trip_id)
    day = get_object_or_404(DailyLog, trip=trip, log_date=log_date)
    pdf_bytes = render_daily_log_pdf(day, trip)
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="log-{log_date}.pdf"'
    return resp


@api_view(["GET"])
def trip_pdf(request, trip_id):
    trip = get_object_or_404(Trip, pk=trip_id)
    pdf_bytes = render_trip_pdf(trip)
    resp = HttpResponse(pdf_bytes, content_type="application/pdf")
    resp["Content-Disposition"] = f'inline; filename="trip-{trip_id}-logs.pdf"'
    return resp
