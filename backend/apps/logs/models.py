from django.db import models


DUTY_STATUS_CHOICES = [
    ("off", "Off Duty"),
    ("sleeper", "Sleeper Berth"),
    ("driving", "Driving"),
    ("onduty", "On Duty (Not Driving)"),
]


class DailyLog(models.Model):
    trip = models.ForeignKey("trips.Trip", related_name="daily_logs", on_delete=models.CASCADE)
    log_date = models.DateField()
    starting_odo = models.IntegerField(null=True, blank=True)
    ending_odo = models.IntegerField(null=True, blank=True)
    total_miles = models.FloatField(default=0.0)
    remarks = models.TextField(blank=True, default="")

    hours_off = models.FloatField(default=0.0)
    hours_sleeper = models.FloatField(default=0.0)
    hours_driving = models.FloatField(default=0.0)
    hours_onduty = models.FloatField(default=0.0)

    class Meta:
        unique_together = [("trip", "log_date")]
        ordering = ["log_date"]


class StatusEvent(models.Model):
    daily_log = models.ForeignKey(DailyLog, related_name="events", on_delete=models.CASCADE)
    start_minute = models.IntegerField()
    end_minute = models.IntegerField()
    status = models.CharField(max_length=10, choices=DUTY_STATUS_CHOICES)
    location = models.CharField(max_length=200, blank=True, default="")
    note = models.CharField(max_length=240, blank=True, default="")
    stop_kind = models.CharField(max_length=16, blank=True, default="")

    class Meta:
        ordering = ["start_minute"]
