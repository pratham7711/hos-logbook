import uuid

from django.db import models


class Trip(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    driver_name = models.CharField(max_length=120, blank=True, default="")
    carrier_name = models.CharField(max_length=120, blank=True, default="")
    truck_number = models.CharField(max_length=40, blank=True, default="")

    current_location = models.JSONField()  # {label, lat, lng}
    pickup_location = models.JSONField()
    dropoff_location = models.JSONField()
    cycle_used_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    depart_at = models.DateTimeField()
    timezone = models.CharField(max_length=64, default="America/New_York")

    route_geojson = models.JSONField(null=True, blank=True)
    total_miles = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    total_drive_hours = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    eta = models.DateTimeField(null=True, blank=True)

    violations = models.JSONField(default=list, blank=True)
    plan_version = models.IntegerField(default=1)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Trip {self.id} {self.pickup_location.get('label','?')} -> {self.dropoff_location.get('label','?')}"


STOP_KIND_CHOICES = [
    ("start", "Start"),
    ("pickup", "Pickup"),
    ("dropoff", "Dropoff"),
    ("fuel", "Fuel"),
    ("break_30", "30-min Break"),
    ("rest_10", "10-hr Reset"),
    ("restart_34", "34-hr Restart"),
]


class Stop(models.Model):
    trip = models.ForeignKey(Trip, related_name="stops", on_delete=models.CASCADE)
    sequence = models.IntegerField()
    kind = models.CharField(max_length=16, choices=STOP_KIND_CHOICES)
    label = models.CharField(max_length=200)
    lat = models.FloatField()
    lng = models.FloatField()
    mile_marker = models.FloatField()
    arrive_at = models.DateTimeField()
    depart_at = models.DateTimeField()
    duration_min = models.IntegerField()
    note = models.CharField(max_length=240, blank=True, default="")

    class Meta:
        ordering = ["sequence"]
        unique_together = [("trip", "sequence")]
