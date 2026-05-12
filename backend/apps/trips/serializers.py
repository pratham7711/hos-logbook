from rest_framework import serializers

from apps.logs.models import DailyLog, StatusEvent

from .models import Stop, Trip


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = [
            "sequence",
            "kind",
            "label",
            "lat",
            "lng",
            "mile_marker",
            "arrive_at",
            "depart_at",
            "duration_min",
            "note",
        ]


class StatusEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusEvent
        fields = ["start_minute", "end_minute", "status", "location", "note", "stop_kind"]


class DailyLogSerializer(serializers.ModelSerializer):
    events = StatusEventSerializer(many=True, read_only=True)
    totals = serializers.SerializerMethodField()

    class Meta:
        model = DailyLog
        fields = [
            "log_date",
            "total_miles",
            "starting_odo",
            "ending_odo",
            "remarks",
            "totals",
            "events",
        ]

    def get_totals(self, obj):
        return {
            "off": obj.hours_off,
            "sleeper": obj.hours_sleeper,
            "driving": obj.hours_driving,
            "onduty": obj.hours_onduty,
        }


class TripCreateSerializer(serializers.Serializer):
    current_location = serializers.JSONField()
    pickup_location = serializers.JSONField()
    dropoff_location = serializers.JSONField()
    cycle_used_hours = serializers.DecimalField(max_digits=5, decimal_places=2)
    depart_at = serializers.DateTimeField()
    timezone = serializers.CharField(required=False, default="America/New_York")
    driver_name = serializers.CharField(required=False, allow_blank=True, default="")
    carrier_name = serializers.CharField(required=False, allow_blank=True, default="")
    truck_number = serializers.CharField(required=False, allow_blank=True, default="")


class TripListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            "id",
            "created_at",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "total_miles",
            "eta",
        ]


class TripDetailSerializer(serializers.ModelSerializer):
    stops = StopSerializer(many=True, read_only=True)
    daily_logs = DailyLogSerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = Trip
        fields = [
            "id",
            "created_at",
            "driver_name",
            "carrier_name",
            "truck_number",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "cycle_used_hours",
            "depart_at",
            "timezone",
            "route_geojson",
            "violations",
            "summary",
            "stops",
            "daily_logs",
        ]

    def get_summary(self, obj):
        return {
            "total_miles": float(obj.total_miles or 0),
            "total_drive_hours": float(obj.total_drive_hours or 0),
            "eta": obj.eta.isoformat() if obj.eta else None,
            "days_required": obj.daily_logs.count(),
            "violations": obj.violations or [],
        }
