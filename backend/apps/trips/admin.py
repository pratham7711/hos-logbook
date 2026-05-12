from django.contrib import admin

from .models import Stop, Trip


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "created_at", "total_miles", "eta")


@admin.register(Stop)
class StopAdmin(admin.ModelAdmin):
    list_display = ("trip", "sequence", "kind", "mile_marker", "arrive_at")
