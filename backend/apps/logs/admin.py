from django.contrib import admin

from .models import DailyLog, StatusEvent


@admin.register(DailyLog)
class DailyLogAdmin(admin.ModelAdmin):
    list_display = ("trip", "log_date", "total_miles", "hours_driving")


@admin.register(StatusEvent)
class StatusEventAdmin(admin.ModelAdmin):
    list_display = ("daily_log", "start_minute", "end_minute", "status")
