"""Convert engine Segments into per-day events covering 0..1440 minute-of-day."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from typing import Any

from zoneinfo import ZoneInfo

from .state import DutyStatus, Segment


@dataclass
class DayEvent:
    start_minute: int  # 0..1440
    end_minute: int  # exclusive; 1440 for the last event of the day
    status: DutyStatus
    location_label: str
    note: str = ""
    stop_kind: str = ""


@dataclass
class DailyLogDTO:
    log_date: date
    events: list[DayEvent]
    miles: float
    totals_hours: dict[DutyStatus, float]


def _minute_of_day(dt: datetime) -> int:
    return dt.hour * 60 + dt.minute


def split_segments_to_daily_logs(
    segments: list[Segment],
    tz_name: str,
) -> list[DailyLogDTO]:
    tz = ZoneInfo(tz_name)
    by_date: dict[date, list[DayEvent]] = defaultdict(list)
    miles_by_date: dict[date, float] = defaultdict(float)

    for seg in segments:
        cur = seg.start_at.astimezone(tz)
        end = seg.end_at.astimezone(tz)
        # Allocate this segment's mileage proportionally across days.
        seg_total_min = max(1, int((end - cur).total_seconds() // 60))
        miles_per_min = seg.miles / seg_total_min

        while cur.date() != end.date():
            next_midnight = datetime.combine(cur.date() + timedelta(days=1), time.min, tzinfo=tz)
            piece_min = int((next_midnight - cur).total_seconds() // 60)
            by_date[cur.date()].append(
                DayEvent(
                    start_minute=_minute_of_day(cur),
                    end_minute=1440,
                    status=seg.status,
                    location_label=seg.location_label,
                    note=seg.note,
                    stop_kind=seg.stop_kind,
                )
            )
            miles_by_date[cur.date()] += piece_min * miles_per_min
            cur = next_midnight

        start_m = _minute_of_day(cur)
        end_m = _minute_of_day(end)
        # Handle exact-midnight end-of-day case (00:00 next day represented as 1440 here)
        if end_m == 0 and end > cur:
            end_m = 1440
        if end_m == start_m:
            continue  # zero-length, skip
        piece_min = end_m - start_m
        by_date[cur.date()].append(
            DayEvent(
                start_minute=start_m,
                end_minute=end_m,
                status=seg.status,
                location_label=seg.location_label,
                note=seg.note,
                stop_kind=seg.stop_kind,
            )
        )
        miles_by_date[cur.date()] += piece_min * miles_per_min

    # Pad each day with off-duty so events cover 0..1440 contiguously.
    daily: list[DailyLogDTO] = []
    for d in sorted(by_date.keys()):
        events = sorted(by_date[d], key=lambda e: e.start_minute)
        padded = _pad_to_full_day(events)
        totals = _compute_totals(padded)
        daily.append(
            DailyLogDTO(
                log_date=d,
                events=padded,
                miles=round(miles_by_date[d], 1),
                totals_hours=totals,
            )
        )

    return daily


def _pad_to_full_day(events: list[DayEvent]) -> list[DayEvent]:
    """Insert off-duty events to fill any gaps and cap to 0..1440."""
    out: list[DayEvent] = []
    cursor = 0
    for e in events:
        if e.start_minute > cursor:
            out.append(DayEvent(cursor, e.start_minute, "off", "", "", ""))
        out.append(e)
        cursor = max(cursor, e.end_minute)
    if cursor < 1440:
        out.append(DayEvent(cursor, 1440, "off", "", "", ""))
    return out


def _compute_totals(events: list[DayEvent]) -> dict[str, float]:
    totals: dict[str, float] = {"off": 0.0, "sleeper": 0.0, "driving": 0.0, "onduty": 0.0}
    for e in events:
        totals[e.status] += (e.end_minute - e.start_minute) / 60.0
    return {k: round(v, 2) for k, v in totals.items()}
