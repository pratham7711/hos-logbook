"""FMCSA Part 395 (trip-focused) rules engine.

A pure-Python state machine that takes (depart_at, cycle_used_hours, legs,
fuel_stops_by_mile) and produces a contiguous list of duty-status Segments
covering the entire trip with all mandatory breaks/rests inserted.

Priority order per iteration (when multiple constraints would fire at once):
  1. 30-min break  -- after 8 cumulative driving hrs since last break
  2. 10-hr off     -- after 11 driving hrs OR after 14-hr window elapsed
  3. 34-hr restart -- only when cycle would otherwise exceed 70 hrs
  4. Drive toward the next waypoint or fuel stop
"""

from __future__ import annotations

from datetime import datetime, timedelta

from .state import (
    DEFAULTS,
    DriverState,
    FuelStop,
    HOSConfig,
    Leg,
    Schedule,
    Segment,
)


def plan_trip(
    *,
    depart_at: datetime,
    cycle_used_hours: float,
    legs: list[Leg],
    fuel_stops_by_mile: list[FuelStop],
    config: HOSConfig = DEFAULTS,
) -> Schedule:
    """Plan a complete HOS-compliant trip.

    legs[0] starts at the driver's current location and ends at pickup.
    legs[1] starts at pickup and ends at dropoff.
    All cumulative mileage is computed against `Leg.end_mile`.
    """
    if not legs:
        raise ValueError("legs must contain at least one leg")

    total_miles = legs[-1].end_mile
    state = DriverState(now=depart_at, cycle_used_hours=cycle_used_hours, last_label=legs[0].origin.label)
    segments: list[Segment] = []
    violations: list[str] = []
    pickup_done = False
    fuels_done: set[float] = set()

    # The "pickup mile" is the end of leg[0]. If only one leg given, treat it
    # as a direct drive with no pickup event.
    pickup_mile = legs[0].end_mile if len(legs) >= 2 else None

    def append(seg: Segment) -> None:
        segments.append(seg)
        # advance state's clock + ledger
        dur_hr = seg.duration_hr
        state.now = seg.end_at
        state.last_label = seg.location_label
        if seg.status == "driving":
            state.drive_hours_since_reset += dur_hr
            state.drive_hours_since_break += dur_hr
            state.onduty_hours_since_reset += dur_hr
            state.cycle_used_hours += dur_hr
            state.miles_done += seg.miles
            if state.window_start is None:
                state.window_start = seg.start_at
        elif seg.status == "onduty":
            state.onduty_hours_since_reset += dur_hr
            state.cycle_used_hours += dur_hr
            if state.window_start is None:
                state.window_start = seg.start_at
            # 30-min break (onduty in our scheme) resets the break counter.
            if seg.note == "30-min break":
                state.drive_hours_since_break = 0.0
        elif seg.status in ("off", "sleeper"):
            # A 10-hr+ reset zeroes the post-reset counters and clears window.
            if dur_hr + 1e-6 >= config.reset_off_hr:
                state.drive_hours_since_reset = 0.0
                state.drive_hours_since_break = 0.0
                state.onduty_hours_since_reset = 0.0
                state.window_start = None
            if dur_hr + 1e-6 >= config.restart_off_hr:
                state.cycle_used_hours = 0.0

    # ---- main loop -------------------------------------------------------
    safety = 0
    while state.miles_done < total_miles - 1e-6:
        safety += 1
        if safety > 5000:
            violations.append("engine: hit iteration ceiling")
            break

        # 1. 30-min break required
        if state.remaining_to_break(config) <= 1e-6 and state.miles_done < total_miles - 1e-6:
            end = state.now + timedelta(minutes=config.break_duration_min)
            append(Segment(state.now, end, "onduty", state.last_label, 0.0, "30-min break", "break_30"))
            continue

        # 2. 10-hr off required
        if state.remaining_drive(config) <= 1e-6 or state.remaining_window(config) <= 1e-6:
            end = state.now + timedelta(hours=config.reset_off_hr)
            append(Segment(state.now, end, "off", state.last_label, 0.0, "10-hr reset", "rest_10"))
            continue

        # 3. 34-hr restart if cycle would be blown by even one more hour of driving
        if state.remaining_cycle(config) <= 1e-6:
            end = state.now + timedelta(hours=config.restart_off_hr)
            append(Segment(state.now, end, "off", state.last_label, 0.0, "34-hr restart", "restart_34"))
            violations.append(
                f"34-hr restart inserted at mile {state.miles_done:.0f} to remain cycle-compliant"
            )
            continue

        # If we're at the very start (no segments yet), drop an off-duty pad
        # so the day's grid before depart_at is filled with off-duty rather
        # than gap. The splitter handles this, but a tiny "start" marker note
        # is useful for the audit trail.

        # 4. Pickup event when we reach pickup_mile
        if pickup_mile is not None and not pickup_done and abs(state.miles_done - pickup_mile) < 1e-3:
            end = state.now + timedelta(minutes=config.pickup_min)
            append(
                Segment(
                    state.now,
                    end,
                    "onduty",
                    legs[0].destination.label,
                    0.0,
                    "Pickup (1 hr)",
                    "pickup",
                )
            )
            pickup_done = True
            continue

        # 5. Fuel stop when we land exactly on a fuel mile
        for f in fuel_stops_by_mile:
            if f.mile in fuels_done:
                continue
            if abs(state.miles_done - f.mile) < 1e-3:
                end = state.now + timedelta(minutes=config.fuel_min)
                append(
                    Segment(
                        state.now,
                        end,
                        "onduty",
                        f.label,
                        0.0,
                        "Fuel stop",
                        "fuel",
                    )
                )
                fuels_done.add(f.mile)
                break
        else:
            # 6. Drive toward the next waypoint
            target = _next_waypoint_mile(
                state.miles_done,
                pickup_mile,
                pickup_done,
                fuel_stops_by_mile,
                fuels_done,
                total_miles,
            )
            _drive_until(state, target, segments, config, append, legs)
            continue
        # The `for` loop hit a fuel stop and we already appended — restart loop.
        continue

    # Final dropoff event (1 hr onduty)
    end = state.now + timedelta(minutes=config.dropoff_min)
    final_label = legs[-1].destination.label
    append(
        Segment(
            state.now,
            end,
            "onduty",
            final_label,
            0.0,
            "Dropoff (1 hr)",
            "dropoff",
        )
    )

    return Schedule(
        segments=segments,
        total_miles=total_miles,
        eta=state.now,
        cycle_used_at_eta=state.cycle_used_hours,
        violations=violations,
    )


# --- helpers ---------------------------------------------------------------


def _next_waypoint_mile(
    miles_done: float,
    pickup_mile: float | None,
    pickup_done: bool,
    fuel_stops: list[FuelStop],
    fuels_done: set[float],
    total_miles: float,
) -> float:
    candidates: list[float] = [total_miles]
    if pickup_mile is not None and not pickup_done and pickup_mile > miles_done + 1e-6:
        candidates.append(pickup_mile)
    for f in fuel_stops:
        if f.mile in fuels_done:
            continue
        if f.mile > miles_done + 1e-6:
            candidates.append(f.mile)
    return min(candidates)


def _drive_until(
    state: DriverState,
    target_mile: float,
    segments: list[Segment],
    cfg: HOSConfig,
    append,
    legs: list[Leg],
) -> None:
    miles_to_go = target_mile - state.miles_done
    if miles_to_go <= 0:
        return
    hours_to_go = miles_to_go / cfg.avg_speed_mph

    # Constrained by the soonest of: 11-hr drive, 14-hr window, 8-hr break
    constraints = [
        state.remaining_drive(cfg),
        state.remaining_window(cfg),
        state.remaining_to_break(cfg),
    ]
    allowed_hr = max(0.0, min(hours_to_go, min(constraints)))
    if allowed_hr <= 1e-9:
        return  # outer loop will fire a break/rest

    miles_this_seg = allowed_hr * cfg.avg_speed_mph
    end = state.now + timedelta(hours=allowed_hr)
    mile_end = state.miles_done + miles_this_seg

    # Pick a label that reflects which leg we're on.
    label = _label_for_mile(mile_end, legs)
    append(
        Segment(
            start_at=state.now,
            end_at=end,
            status="driving",
            location_label=label,
            miles=miles_this_seg,
            note="",
            stop_kind="",
        )
    )


def _label_for_mile(mile: float, legs: list[Leg]) -> str:
    """Best-effort label for a position along the trip."""
    for leg in legs:
        if mile <= leg.end_mile + 1e-6:
            return f"En route to {leg.destination.label}"
    return f"Mile {mile:.0f}"
