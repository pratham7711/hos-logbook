import type { StatusEvent, DutyStatus } from "@/types/api";
import { rowForStatus } from "./gridConstants";

export interface PlotGeometry {
  /** left edge of the plotting area in SVG units */
  plotX: number;
  /** top edge of the plotting area in SVG units */
  plotY: number;
  /** width of plotting area (24 hours) */
  plotW: number;
  /** height of plotting area (4 rows) */
  plotH: number;
}

export interface SegmentPrim {
  kind: "segment";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  event: StatusEvent;
  rowIdx: number;
}

export interface ConnectorPrim {
  kind: "connector";
  x: number;
  y1: number;
  y2: number;
  fromStatus: DutyStatus;
  toStatus: DutyStatus;
  minute: number;
}

export interface FlagPrim {
  kind: "flag";
  x: number;
  y: number;
  text: string;
  minute: number;
  /** vertical lane (0 = closest to grid). Used for stagger. */
  lane: number;
}

export interface HitZonePrim {
  kind: "hit";
  x: number;
  y: number;
  w: number;
  h: number;
  rowIdx: number;
  event: StatusEvent;
}

export type Primitive = SegmentPrim | ConnectorPrim | FlagPrim | HitZonePrim;

const minuteToX = (minute: number, geom: PlotGeometry): number =>
  geom.plotX + (minute / 1440) * geom.plotW;

const rowCenterY = (rowIdx: number, geom: PlotGeometry): number => {
  const rowH = geom.plotH / 4;
  return geom.plotY + rowIdx * rowH + rowH / 2;
};

/**
 * Pure geometry: convert events into primitives we can render.
 * - segments: one horizontal line per event at its row centerline
 * - connectors: vertical line between consecutive events with different statuses
 * - flags: text labels above transitions where event.note exists (stagger lanes)
 * - hit: transparent hit rectangles per event (full row height) for hover
 */
export function eventsToPaths(
  events: StatusEvent[],
  geom: PlotGeometry,
): Primitive[] {
  const out: Primitive[] = [];
  if (!events || events.length === 0) return out;

  const sorted = [...events].sort((a, b) => a.start_minute - b.start_minute);
  const rowH = geom.plotH / 4;

  // Segments + hit zones
  for (const ev of sorted) {
    const rowIdx = rowForStatus(ev.status);
    const x1 = minuteToX(ev.start_minute, geom);
    const x2 = minuteToX(ev.end_minute, geom);
    const yMid = rowCenterY(rowIdx, geom);
    out.push({
      kind: "segment",
      x1,
      y1: yMid,
      x2,
      y2: yMid,
      event: ev,
      rowIdx,
    });
    out.push({
      kind: "hit",
      x: x1,
      y: geom.plotY + rowIdx * rowH,
      w: Math.max(0, x2 - x1),
      h: rowH,
      rowIdx,
      event: ev,
    });
  }

  // Connectors between consecutive events with differing statuses
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (a.status === b.status) continue;
    const rowA = rowForStatus(a.status);
    const rowB = rowForStatus(b.status);
    const x = minuteToX(b.start_minute, geom);
    out.push({
      kind: "connector",
      x,
      y1: rowCenterY(rowA, geom),
      y2: rowCenterY(rowB, geom),
      fromStatus: a.status,
      toStatus: b.status,
      minute: b.start_minute,
    });
  }

  // Flags: transitions where the *incoming* event has a note
  // Place flag above the topmost row touched by the transition.
  const flagBaseY = geom.plotY - 6;
  const laneStep = 12;
  // Track lane occupancy in x-space (sliding window)
  const lanes: number[] = []; // each lane stores last x used
  const flagPx = 90; // approx px width budget per flag

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    if (!ev.note || !ev.note.trim()) continue;
    const minute = ev.start_minute;
    const x = minuteToX(minute, geom);
    // pick lowest lane whose last x is far enough
    let lane = 0;
    while (lane < lanes.length && x - lanes[lane] < flagPx) lane++;
    if (lane === lanes.length) lanes.push(x);
    else lanes[lane] = x;
    out.push({
      kind: "flag",
      x,
      y: flagBaseY - lane * laneStep,
      text: ev.note,
      minute,
      lane,
    });
  }

  return out;
}
