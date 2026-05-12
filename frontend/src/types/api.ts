// Contract between Django backend and React frontend.
// Mirrors apps/trips/serializers.py and apps/logs/serializers.py.

export type DutyStatus = "off" | "sleeper" | "driving" | "onduty";

export type StopKind =
  | "start"
  | "pickup"
  | "dropoff"
  | "fuel"
  | "break_30"
  | "rest_10"
  | "restart_34";

export interface GeoLoc {
  label: string;
  lat: number;
  lng: number;
}

export interface Stop {
  sequence: number;
  kind: StopKind;
  label: string;
  lat: number;
  lng: number;
  mile_marker: number;
  arrive_at: string; // ISO
  depart_at: string;
  duration_min: number;
  note: string;
}

export interface StatusEvent {
  start_minute: number; // 0..1440
  end_minute: number;
  status: DutyStatus;
  location: string;
  note: string;
  stop_kind: string;
}

export interface DailyLog {
  log_date: string; // YYYY-MM-DD
  total_miles: number;
  starting_odo: number | null;
  ending_odo: number | null;
  remarks: string;
  totals: Record<DutyStatus, number>;
  events: StatusEvent[];
}

export interface TripSummary {
  total_miles: number;
  total_drive_hours: number;
  eta: string | null;
  days_required: number;
  violations: string[];
}

export interface RouteGeoJSON {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
}

export interface TripDetail {
  id: string;
  created_at: string;
  driver_name: string;
  carrier_name: string;
  truck_number: string;
  current_location: GeoLoc;
  pickup_location: GeoLoc;
  dropoff_location: GeoLoc;
  cycle_used_hours: string; // DRF Decimal -> string
  depart_at: string;
  timezone: string;
  route_geojson: RouteGeoJSON | null;
  violations: string[];
  summary: TripSummary;
  stops: Stop[];
  daily_logs: DailyLog[];
}

export interface TripListItem {
  id: string;
  created_at: string;
  current_location: GeoLoc;
  pickup_location: GeoLoc;
  dropoff_location: GeoLoc;
  total_miles: number | null;
  eta: string | null;
}

export interface TripCreatePayload {
  current_location: string | GeoLoc;
  pickup_location: string | GeoLoc;
  dropoff_location: string | GeoLoc;
  cycle_used_hours: number;
  depart_at: string; // ISO
  timezone?: string;
  driver_name?: string;
  carrier_name?: string;
  truck_number?: string;
}
