"""Pure data types for the HOS rules engine. No Django, no I/O."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

DutyStatus = Literal["off", "sleeper", "driving", "onduty"]

STOP_KIND_TO_STATUS: dict[str, DutyStatus] = {
    "start": "off",
    "pickup": "onduty",
    "dropoff": "onduty",
    "fuel": "onduty",
    "break_30": "onduty",
    "rest_10": "off",
    "restart_34": "off",
}


@dataclass(frozen=True)
class GeoPoint:
    label: str
    lat: float
    lng: float


@dataclass(frozen=True)
class Leg:
    """A driving leg between two GeoPoints."""

    origin: GeoPoint
    destination: GeoPoint
    miles: float
    # Cumulative miles from the start of the entire trip at which this leg ENDS.
    end_mile: float


@dataclass(frozen=True)
class FuelStop:
    mile: float
    lat: float
    lng: float
    label: str


@dataclass
class HOSConfig:
    max_drive_hr: float = 11.0
    max_window_hr: float = 14.0
    break_after_drive_hr: float = 8.0
    break_duration_min: int = 30
    reset_off_hr: float = 10.0
    cycle_hr: float = 70.0
    cycle_days: int = 8
    restart_off_hr: float = 34.0
    avg_speed_mph: float = 55.0
    pickup_min: int = 60
    dropoff_min: int = 60
    fuel_min: int = 15
    fuel_every_miles: float = 1000.0


DEFAULTS = HOSConfig()


@dataclass
class Segment:
    start_at: datetime
    end_at: datetime
    status: DutyStatus
    location_label: str
    miles: float = 0.0
    note: str = ""
    stop_kind: str = ""  # used by the orchestrator to mint Stop rows

    @property
    def duration_hr(self) -> float:
        return (self.end_at - self.start_at).total_seconds() / 3600.0


@dataclass
class Schedule:
    segments: list[Segment]
    total_miles: float
    eta: datetime
    cycle_used_at_eta: float
    violations: list[str] = field(default_factory=list)


@dataclass
class DriverState:
    """Mutable state advanced by the engine loop."""

    now: datetime
    cycle_used_hours: float
    drive_hours_since_reset: float = 0.0
    onduty_hours_since_reset: float = 0.0
    drive_hours_since_break: float = 0.0
    window_start: datetime | None = None  # 14-hr clock anchor
    miles_done: float = 0.0
    last_label: str = ""

    def remaining_drive(self, cfg: HOSConfig) -> float:
        return max(0.0, cfg.max_drive_hr - self.drive_hours_since_reset)

    def remaining_window(self, cfg: HOSConfig) -> float:
        if self.window_start is None:
            return cfg.max_window_hr
        elapsed = (self.now - self.window_start).total_seconds() / 3600.0
        return max(0.0, cfg.max_window_hr - elapsed)

    def remaining_to_break(self, cfg: HOSConfig) -> float:
        return max(0.0, cfg.break_after_drive_hr - self.drive_hours_since_break)

    def remaining_cycle(self, cfg: HOSConfig) -> float:
        return max(0.0, cfg.cycle_hr - self.cycle_used_hours)
