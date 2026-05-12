"""Orchestrator: geocode -> ORS -> hos.plan_trip -> persist."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from django.db import transaction
from zoneinfo import ZoneInfo

from apps.hos.engine import plan_trip
from apps.hos.splitter import split_segments_to_daily_logs
from apps.hos.state import DEFAULTS, FuelStop, GeoPoint, Leg, Segment
from apps.logs.models import DailyLog, StatusEvent
from apps.routing.geometry import cumulative_distances, point_at_mile
from apps.routing.ors_client import get_client

from ..models import Stop, Trip


def _resolve_locations(payload: dict, client) -> tuple[dict, dict, dict]:
    """Each location may arrive as a free-text string OR as {label,lat,lng}."""
    out = []
    for key in ("current_location", "pickup_location", "dropoff_location"):
        v = payload[key]
        if isinstance(v, dict) and "lat" in v and "lng" in v:
            out.append({"label": v.get("label", ""), "lat": float(v["lat"]), "lng": float(v["lng"])})
        else:
            g = client.geocode(str(v))
            out.append({"label": g.label, "lat": g.lat, "lng": g.lng})
    return tuple(out)  # type: ignore[return-value]


def _ors_to_legs(coords: list[tuple[float, float]], cum: list[float], locs: list[dict]) -> list[Leg]:
    """Convert three locations + a polyline into two cumulative legs."""
    pickup_lng, pickup_lat = locs[1]["lng"], locs[1]["lat"]
    # Find the index in coords closest to the pickup point — that's our pickup mile.
    best_idx, best_d = 0, float("inf")
    for i, (lng, lat) in enumerate(coords):
        d = (lng - pickup_lng) ** 2 + (lat - pickup_lat) ** 2
        if d < best_d:
            best_d, best_idx = d, i
    pickup_mile = cum[best_idx]
    total_mile = cum[-1]
    return [
        Leg(
            origin=GeoPoint(locs[0]["label"], locs[0]["lat"], locs[0]["lng"]),
            destination=GeoPoint(locs[1]["label"], locs[1]["lat"], locs[1]["lng"]),
            miles=pickup_mile,
            end_mile=pickup_mile,
        ),
        Leg(
            origin=GeoPoint(locs[1]["label"], locs[1]["lat"], locs[1]["lng"]),
            destination=GeoPoint(locs[2]["label"], locs[2]["lat"], locs[2]["lng"]),
            miles=total_mile - pickup_mile,
            end_mile=total_mile,
        ),
    ]


def _build_fuel_stops(coords, cum, total_miles: float) -> list[FuelStop]:
    out: list[FuelStop] = []
    mile = 1000.0
    while mile < total_miles:
        lng, lat = point_at_mile(coords, cum, mile)
        out.append(FuelStop(mile=mile, lat=lat, lng=lng, label=f"Fuel stop @ mile {mile:.0f}"))
        mile += 1000.0
    return out


def _label_for_mile(coords, cum, mile: float) -> tuple[str, float, float]:
    lng, lat = point_at_mile(coords, cum, mile)
    return (f"Mile {mile:.0f}", lat, lng)


def _running_mile_for_segments(segments: list[Segment]) -> list[float]:
    out, m = [], 0.0
    for s in segments:
        m += s.miles
        out.append(m)
    return out


@transaction.atomic
def create_and_plan_trip(payload: dict[str, Any]) -> Trip:
    client = get_client()
    current, pickup, dropoff = _resolve_locations(payload, client)

    route = client.directions(
        [
            (current["lng"], current["lat"]),
            (pickup["lng"], pickup["lat"]),
            (dropoff["lng"], dropoff["lat"]),
        ],
        profile="driving-hgv",
    )
    coords = route.coordinates
    cum = cumulative_distances(coords)
    total_miles = cum[-1]

    legs = _ors_to_legs(coords, cum, [current, pickup, dropoff])
    fuel_stops = _build_fuel_stops(coords, cum, total_miles)

    tz_name = payload.get("timezone") or "America/New_York"
    tz = ZoneInfo(tz_name)
    depart_at = payload.get("depart_at")
    if isinstance(depart_at, str):
        s = depart_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        # If the string was naive (no offset), the user meant it in `tz_name`.
        # If it had an offset (e.g. "...Z" or "+05:30"), keep its absolute moment
        # but re-anchor to the requested tz for display continuity.
        if dt.tzinfo is None:
            depart_at = dt.replace(tzinfo=tz)
        else:
            depart_at = dt.astimezone(tz)
    if depart_at is None:
        depart_at = datetime.now(tz)

    schedule = plan_trip(
        depart_at=depart_at,
        cycle_used_hours=float(payload.get("cycle_used_hours") or 0),
        legs=legs,
        fuel_stops_by_mile=fuel_stops,
    )

    # Persist the Trip
    trip = Trip.objects.create(
        driver_name=payload.get("driver_name", "") or "",
        carrier_name=payload.get("carrier_name", "") or "",
        truck_number=payload.get("truck_number", "") or "",
        current_location=current,
        pickup_location=pickup,
        dropoff_location=dropoff,
        cycle_used_hours=payload.get("cycle_used_hours") or 0,
        depart_at=depart_at,
        timezone=tz_name,
        route_geojson={"type": "LineString", "coordinates": [list(c) for c in coords]},
        total_miles=round(total_miles, 2),
        total_drive_hours=round(
            sum(s.duration_hr for s in schedule.segments if s.status == "driving"), 2
        ),
        eta=schedule.eta,
        violations=schedule.violations,
    )

    # Persist Stops — derive lat/lng for non-driving segments from their running mile.
    running_miles = _running_mile_for_segments(schedule.segments)
    cum_done = 0.0
    seq = 0
    # Implicit "start" stop at mile 0
    Stop.objects.create(
        trip=trip,
        sequence=seq,
        kind="start",
        label=current["label"],
        lat=current["lat"],
        lng=current["lng"],
        mile_marker=0.0,
        arrive_at=depart_at,
        depart_at=depart_at,
        duration_min=0,
        note="Start",
    )
    seq += 1

    for seg, mile_now in zip(schedule.segments, running_miles):
        kind = seg.stop_kind
        if not kind:
            cum_done = mile_now
            continue
        # Use the running mile at the START of the segment to fix the geo point.
        start_mile = max(0.0, mile_now - seg.miles)
        if kind == "pickup":
            lat, lng = pickup["lat"], pickup["lng"]
            label = pickup["label"]
        elif kind == "dropoff":
            lat, lng = dropoff["lat"], dropoff["lng"]
            label = dropoff["label"]
        else:
            lng, lat = point_at_mile(coords, cum, start_mile)
            label = seg.location_label or f"Mile {start_mile:.0f}"
        Stop.objects.create(
            trip=trip,
            sequence=seq,
            kind=kind,
            label=label,
            lat=lat,
            lng=lng,
            mile_marker=round(start_mile, 2),
            arrive_at=seg.start_at,
            depart_at=seg.end_at,
            duration_min=int(round(seg.duration_hr * 60)),
            note=seg.note,
        )
        seq += 1
        cum_done = mile_now

    # Persist DailyLogs + StatusEvents
    daily_dtos = split_segments_to_daily_logs(schedule.segments, tz_name)
    for d in daily_dtos:
        dl = DailyLog.objects.create(
            trip=trip,
            log_date=d.log_date,
            total_miles=d.miles,
            hours_off=d.totals_hours["off"],
            hours_sleeper=d.totals_hours["sleeper"],
            hours_driving=d.totals_hours["driving"],
            hours_onduty=d.totals_hours["onduty"],
        )
        StatusEvent.objects.bulk_create(
            [
                StatusEvent(
                    daily_log=dl,
                    start_minute=e.start_minute,
                    end_minute=e.end_minute,
                    status=e.status,
                    location=e.location_label,
                    note=e.note,
                    stop_kind=e.stop_kind,
                )
                for e in d.events
            ]
        )

    return trip
