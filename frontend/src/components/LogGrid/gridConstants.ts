import type { DutyStatus } from "@/types/api";

// 24 hours × 4 quarters = 96 columns
export const COLS = 96;
export const ROWS = 4;

export const STATUS_ORDER: DutyStatus[] = [
  "off",
  "sleeper",
  "driving",
  "onduty",
];

export const STATUS_LABEL: Record<DutyStatus, string> = {
  off: "1: OFF DUTY",
  sleeper: "2: SLEEPER BERTH",
  driving: "3: DRIVING",
  onduty: "4: ON DUTY (NOT DRIVING)",
};

export const STATUS_LABEL_SHORT: Record<DutyStatus, string> = {
  off: "Off Duty",
  sleeper: "Sleeper Berth",
  driving: "Driving",
  onduty: "On Duty (Not Driving)",
};

// Returns row index 0..3 for a duty status
export const rowForStatus = (s: DutyStatus): number => {
  const idx = STATUS_ORDER.indexOf(s);
  return idx === -1 ? 0 : idx;
};

// 25 hour labels — Midnight, 1..11, noon, 1..11 (last cell shows "" since
// the right edge is implied as Midnight again, drawn separately).
export const HOUR_LABELS: string[] = (() => {
  const out: string[] = ["Midnight"];
  for (let i = 1; i <= 11; i++) out.push(String(i));
  out.push("noon");
  for (let i = 1; i <= 11; i++) out.push(String(i));
  return out;
})();

// FMCSA-style descriptive event names used in remarks.
export const STOP_KIND_REMARK: Record<string, string> = {
  start: "Start",
  pickup: "Pickup",
  dropoff: "Dropoff",
  fuel: "Fuel",
  break_30: "30-min break",
  rest_10: "10-hr off-duty",
  restart_34: "34-hr restart",
};
