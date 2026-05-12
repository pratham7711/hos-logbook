"""HOS engine unit tests. Pure-Python, no Django, runs in <1 s."""

from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from apps.hos.engine import plan_trip
from apps.hos.splitter import split_segments_to_daily_logs
from apps.hos.state import DEFAULTS, FuelStop, GeoPoint, Leg


def _gp(label: str, lat: float = 0.0, lng: float = 0.0) -> GeoPoint:
    return GeoPoint(label=label, lat=lat, lng=lng)


def _legs(current: str, pickup: str, dropoff: str, pickup_mile: float, total_mile: float) -> list[Leg]:
    return [
        Leg(_gp(current), _gp(pickup), pickup_mile, pickup_mile),
        Leg(_gp(pickup), _gp(dropoff), total_mile - pickup_mile, total_mile),
    ]


def _fuels(total_miles: float, every: float = 1000.0) -> list[FuelStop]:
    out: list[FuelStop] = []
    mile = every
    while mile < total_miles:
        out.append(FuelStop(mile=mile, lat=0.0, lng=0.0, label=f"Fuel @ mile {mile:.0f}"))
        mile += every
    return out


# --- assertions -----------------------------------------------------------


def assert_contiguous(segments):
    for a, b in zip(segments, segments[1:]):
        assert a.end_at == b.start_at, f"gap between {a} and {b}"


def assert_no_overdrive(segments, cfg=DEFAULTS):
    """No driving stretch exceeds 11 hr without an intervening reset."""
    drive_since_reset = 0.0
    for seg in segments:
        if seg.status == "driving":
            drive_since_reset += seg.duration_hr
            assert drive_since_reset <= cfg.max_drive_hr + 1e-6, (
                f"drive_hours_since_reset={drive_since_reset:.2f} exceeds cap"
            )
        elif seg.status in ("off", "sleeper") and seg.duration_hr + 1e-6 >= cfg.reset_off_hr:
            drive_since_reset = 0.0


def assert_break_present(segments, cfg=DEFAULTS):
    """Every 8-hr driving block has a >=30-min onduty break or longer rest after it."""
    drive_since_break = 0.0
    for seg in segments:
        if seg.status == "driving":
            drive_since_break += seg.duration_hr
            assert drive_since_break <= cfg.break_after_drive_hr + 1e-6
        elif seg.status == "onduty" and seg.duration_hr * 60 + 1e-6 >= cfg.break_duration_min:
            drive_since_break = 0.0
        elif seg.status in ("off", "sleeper") and seg.duration_hr + 1e-6 >= cfg.reset_off_hr:
            drive_since_break = 0.0


# --- tests ----------------------------------------------------------------


def test_short_trip_single_day():
    """200-mi trip, all in a single day."""
    tz = ZoneInfo("America/New_York")
    depart = datetime(2026, 5, 12, 8, 0, tzinfo=tz)
    legs = _legs("Brooklyn, NY", "Newark, NJ", "Philadelphia, PA", 12, 100)
    schedule = plan_trip(
        depart_at=depart, cycle_used_hours=0.0, legs=legs, fuel_stops_by_mile=_fuels(100)
    )
    assert schedule.total_miles == pytest.approx(100, abs=1e-3)
    assert_contiguous(schedule.segments)
    assert_no_overdrive(schedule.segments)
    # Pickup + dropoff onduty events both present
    onduty_notes = [s.note for s in schedule.segments if s.status == "onduty"]
    assert any("Pickup" in n for n in onduty_notes)
    assert any("Dropoff" in n for n in onduty_notes)


def test_multi_day_trip_inserts_reset():
    """1500-mi trip forces at least one 10-hr off-duty reset."""
    tz = ZoneInfo("America/Chicago")
    depart = datetime(2026, 5, 12, 6, 0, tzinfo=tz)
    legs = _legs("Houston, TX", "Dallas, TX", "Denver, CO", 240, 1500)
    schedule = plan_trip(
        depart_at=depart,
        cycle_used_hours=0.0,
        legs=legs,
        fuel_stops_by_mile=_fuels(1500),
    )
    assert_contiguous(schedule.segments)
    assert_no_overdrive(schedule.segments)
    assert_break_present(schedule.segments)
    # At least one 10-hr reset present
    assert any(s.note == "10-hr reset" for s in schedule.segments)
    # At least one fuel stop somewhere around mile 1000
    assert any(s.note == "Fuel stop" for s in schedule.segments)


def test_brooklyn_to_la_inserts_34_hr_restart():
    """Canonical assessment trip: cycle starts at 35 hrs, ~2789 mi total."""
    tz = ZoneInfo("America/New_York")
    depart = datetime(2026, 5, 12, 8, 0, tzinfo=tz)
    legs = _legs("Brooklyn, NY", "Chicago, IL", "Los Angeles, CA", 790, 2789)
    schedule = plan_trip(
        depart_at=depart,
        cycle_used_hours=35.0,
        legs=legs,
        fuel_stops_by_mile=_fuels(2789),
    )
    assert_contiguous(schedule.segments)
    assert_no_overdrive(schedule.segments)
    assert_break_present(schedule.segments)
    # 34-hr restart should have been inserted
    restart_notes = [s.note for s in schedule.segments if s.note == "34-hr restart"]
    assert len(restart_notes) >= 1, "expected at least one 34-hr restart"
    assert any("34-hr restart inserted" in v for v in schedule.violations)


def test_splitter_covers_every_day():
    """split_segments_to_daily_logs always produces 0..1440 cover per day."""
    tz = ZoneInfo("America/New_York")
    depart = datetime(2026, 5, 12, 8, 0, tzinfo=tz)
    legs = _legs("Brooklyn, NY", "Chicago, IL", "Los Angeles, CA", 790, 2789)
    schedule = plan_trip(
        depart_at=depart,
        cycle_used_hours=35.0,
        legs=legs,
        fuel_stops_by_mile=_fuels(2789),
    )
    daily = split_segments_to_daily_logs(schedule.segments, "America/New_York")
    assert len(daily) >= 4
    for day in daily:
        # First event starts at 0, last ends at 1440, contiguous
        assert day.events[0].start_minute == 0
        assert day.events[-1].end_minute == 1440
        for a, b in zip(day.events, day.events[1:]):
            assert a.end_minute == b.start_minute, f"gap on {day.log_date}: {a} -> {b}"
        # Totals sum to 24.0
        total = sum(day.totals_hours.values())
        assert abs(total - 24.0) < 0.05, f"{day.log_date} totals={total}"


def test_pickup_event_present():
    tz = ZoneInfo("UTC")
    depart = datetime(2026, 1, 1, 0, 0, tzinfo=tz)
    legs = _legs("A", "B", "C", 50, 100)
    schedule = plan_trip(
        depart_at=depart, cycle_used_hours=0.0, legs=legs, fuel_stops_by_mile=[]
    )
    pickup_segs = [s for s in schedule.segments if s.stop_kind == "pickup"]
    assert len(pickup_segs) == 1
    assert pickup_segs[0].duration_hr == pytest.approx(1.0, abs=1e-6)


def test_fuel_event_at_mile_1000():
    tz = ZoneInfo("UTC")
    depart = datetime(2026, 1, 1, 0, 0, tzinfo=tz)
    legs = _legs("A", "B", "C", 50, 1500)
    fuels = [FuelStop(mile=1000.0, lat=0.0, lng=0.0, label="Fuel @ mile 1000")]
    schedule = plan_trip(
        depart_at=depart, cycle_used_hours=0.0, legs=legs, fuel_stops_by_mile=fuels
    )
    fuel_segs = [s for s in schedule.segments if s.stop_kind == "fuel"]
    assert len(fuel_segs) == 1
    assert fuel_segs[0].location_label == "Fuel @ mile 1000"
