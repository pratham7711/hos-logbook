import { useMemo, useState } from "react";
import type { DailyLog, DutyStatus, StatusEvent } from "@/types/api";
import { cn } from "@/lib/cn";
import { fmtClock } from "@/lib/format";
import {
  COLS,
  HOUR_LABELS,
  ROWS,
  STATUS_LABEL,
  STATUS_LABEL_SHORT,
  STATUS_ORDER,
  STOP_KIND_REMARK,
  rowForStatus,
} from "./gridConstants";

interface LogGridProps {
  dailyLog: DailyLog;
  width?: number;
  height?: number;
  className?: string;
  /** When true, drops the colored accents (red dots, blue grid) for monochrome print/officer. */
  monochrome?: boolean;
}

// --- viewBox dimensions in SVG units -------------------------------------
const VB_W = 1100;
const VB_H = 460;
const PAD_LEFT = 180; // room for left status labels
const PAD_RIGHT = 110; // totals column "HOURS"
const GRID_TOP = 56;
const GRID_H = 184;
const REMARKS_TOP = GRID_TOP + GRID_H + 22;
const REMARKS_H = 160;

const PLOT_X = PAD_LEFT;
const PLOT_W = VB_W - PAD_LEFT - PAD_RIGHT;
const ROW_H = GRID_H / ROWS;

// Paper-log feel: faint blue grid lines, black status line with red dot
// vertices. These are token-aware via CSS variables defined inside the SVG.
const GRID_LINE = "var(--logbook-grid, #93a8d6)";
const GRID_LINE_BOLD = "var(--logbook-grid-bold, #4f6dad)";
const TICK = "var(--logbook-grid, #93a8d6)";
const LABEL_INK = "var(--logbook-label, #2c427a)";
const HEADING_INK = "var(--logbook-heading, #1f2d52)";
const DOT_FILL = "var(--logbook-dot, #dc2626)";
const STATUS_INK = "var(--logbook-ink, #0f1320)";

const minuteToX = (m: number) => PLOT_X + (m / 1440) * PLOT_W;
const rowCenterY = (r: number) => GRID_TOP + r * ROW_H + ROW_H / 2;

export function LogGrid({
  dailyLog,
  width = 1100,
  height = 460,
  className,
  monochrome = false,
}: LogGridProps) {
  const [hoverRow, setHoverRow] = useState<number | null>(null);

  const sortedEvents = useMemo<StatusEvent[]>(
    () => [...dailyLog.events].sort((a, b) => a.start_minute - b.start_minute),
    [dailyLog.events],
  );

  // Build the transition vertices (each unique status change) for red dots.
  const transitions = useMemo(() => {
    const pts: { x: number; y: number; ev: StatusEvent }[] = [];
    if (sortedEvents.length === 0) return pts;
    for (let i = 0; i < sortedEvents.length; i++) {
      const ev = sortedEvents[i];
      const r = rowForStatus(ev.status);
      pts.push({ x: minuteToX(ev.start_minute), y: rowCenterY(r), ev });
      if (i === sortedEvents.length - 1) {
        pts.push({ x: minuteToX(ev.end_minute), y: rowCenterY(r), ev });
      }
    }
    return pts;
  }, [sortedEvents]);

  // Build remark labels: anchored at notable transitions (pickup/dropoff/
  // fuel/break/rest/restart). Each label has 2 lines: location + event-name.
  // We stagger overlapping labels into lanes (lane 0 closest to grid).
  const remarks = useMemo(() => buildRemarks(sortedEvents), [sortedEvents]);

  return (
    <svg
      role="img"
      aria-label={`Daily log grid for ${dailyLog.log_date}`}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block select-none", className)}
      style={
        {
          overflow: "visible",
          ...(monochrome
            ? ({
                "--logbook-grid": "#000",
                "--logbook-grid-bold": "#000",
                "--logbook-label": "#000",
                "--logbook-heading": "#000",
                "--logbook-dot": "#000",
                "--logbook-ink": "#000",
              } as React.CSSProperties)
            : ({
                "--logbook-grid": "#9eb1da",
                "--logbook-grid-bold": "#4f6dad",
                "--logbook-label": "#3a4f86",
                "--logbook-heading": "#1f2d52",
                "--logbook-dot": "#e11d48",
                "--logbook-ink": "var(--fg)",
              } as React.CSSProperties)),
        } as React.CSSProperties
      }
    >
      {/* ---- top hour labels ------------------------------------------- */}
      {HOUR_LABELS.map((label, h) => {
        const x = PLOT_X + h * (PLOT_W / 24);
        return (
          <text
            key={`top-${h}`}
            x={x}
            y={GRID_TOP - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill={LABEL_INK}
          >
            {label}
          </text>
        );
      })}

      {/* ---- grid: row bands & status labels ---------------------------- */}
      {STATUS_ORDER.map((status, rIdx) => {
        const y = GRID_TOP + rIdx * ROW_H;
        const isHover = hoverRow === rIdx;
        return (
          <g key={status}>
            {isHover && (
              <rect
                x={PLOT_X}
                y={y}
                width={PLOT_W}
                height={ROW_H}
                fill="var(--accent)"
                fillOpacity={0.07}
                pointerEvents="none"
              />
            )}
            <text
              x={PLOT_X - 12}
              y={y + ROW_H / 2 + 4}
              textAnchor="end"
              fontSize={12}
              fontWeight={600}
              fill={HEADING_INK}
            >
              {STATUS_LABEL[status]}
            </text>
          </g>
        );
      })}

      {/* ---- quarter-hour tick marks inside each row --------------------- */}
      {Array.from({ length: COLS + 1 }, (_, i) => {
        const x = PLOT_X + (i / COLS) * PLOT_W;
        const isHour = i % 4 === 0;
        return STATUS_ORDER.map((_, rIdx) => {
          const yTop = GRID_TOP + rIdx * ROW_H;
          const yBot = yTop + ROW_H;
          const stub = isHour ? ROW_H * 0.35 : 5;
          return (
            <g key={`tk-${i}-${rIdx}`}>
              <line
                x1={x}
                x2={x}
                y1={yTop}
                y2={yTop + stub}
                stroke={TICK}
                strokeWidth={isHour ? 0.7 : 0.4}
              />
              <line
                x1={x}
                x2={x}
                y1={yBot - stub}
                y2={yBot}
                stroke={TICK}
                strokeWidth={isHour ? 0.7 : 0.4}
              />
            </g>
          );
        });
      })}

      {/* ---- horizontal row separators ----------------------------------- */}
      {Array.from({ length: ROWS + 1 }, (_, r) => {
        const y = GRID_TOP + r * ROW_H;
        return (
          <line
            key={`row-${r}`}
            x1={PLOT_X}
            x2={PLOT_X + PLOT_W}
            y1={y}
            y2={y}
            stroke={GRID_LINE_BOLD}
            strokeWidth={r === 0 || r === ROWS ? 1.1 : 0.7}
          />
        );
      })}

      {/* ---- major hour vertical lines + thicker at 6/N/18 -------------- */}
      {Array.from({ length: 25 }, (_, h) => {
        const x = PLOT_X + h * (PLOT_W / 24);
        const strong = h === 0 || h === 24 || h === 6 || h === 12 || h === 18;
        return (
          <line
            key={`hl-${h}`}
            x1={x}
            x2={x}
            y1={GRID_TOP}
            y2={GRID_TOP + GRID_H}
            stroke={strong ? GRID_LINE_BOLD : GRID_LINE}
            strokeWidth={strong ? 0.9 : 0.55}
          />
        );
      })}

      {/* ---- status polyline (thick black) ------------------------------ */}
      <g aria-hidden="true">
        {sortedEvents.map((ev, i) => {
          const r = rowForStatus(ev.status);
          const yMid = rowCenterY(r);
          const x1 = minuteToX(ev.start_minute);
          const x2 = minuteToX(ev.end_minute);
          const next = sortedEvents[i + 1];
          return (
            <g key={`s-${i}`}>
              <line
                x1={x1}
                y1={yMid}
                x2={x2}
                y2={yMid}
                stroke={STATUS_INK}
                strokeWidth={2.8}
                strokeLinecap="square"
              />
              {next && next.status !== ev.status && (
                <line
                  x1={x2}
                  y1={yMid}
                  x2={x2}
                  y2={rowCenterY(rowForStatus(next.status))}
                  stroke={STATUS_INK}
                  strokeWidth={2.8}
                  strokeLinecap="square"
                />
              )}
            </g>
          );
        })}
      </g>

      {/* ---- red dot vertices at every transition ------------------------ */}
      <g aria-hidden="true">
        {transitions.map((p, i) => (
          <circle key={`d-${i}`} cx={p.x} cy={p.y} r={3.4} fill={DOT_FILL} />
        ))}
      </g>

      {/* ---- bottom hour labels (mirror of top) -------------------------- */}
      {HOUR_LABELS.map((label, h) => {
        const x = PLOT_X + h * (PLOT_W / 24);
        return (
          <text
            key={`bot-${h}`}
            x={x}
            y={GRID_TOP + GRID_H + 14}
            textAnchor="middle"
            fontSize={11}
            fontWeight={500}
            fill={LABEL_INK}
          >
            {label}
          </text>
        );
      })}

      {/* ---- REMARKS label ----------------------------------------------- */}
      <text
        x={PLOT_X - 12}
        y={REMARKS_TOP + 4}
        textAnchor="end"
        fontSize={13}
        fontWeight={700}
        letterSpacing={0.4}
        fill={HEADING_INK}
      >
        REMARKS
      </text>

      {/* ---- remarks: leader lines + rotated 2-line labels -------------- */}
      <g>
        {remarks.map((r) => {
          // Leader line drops from grid bottom to the shelf at REMARKS_TOP
          // (vertical) then extends a tiny horizontal segment to the text
          // anchor for a cleaner T-junction look.
          const startY = GRID_TOP + GRID_H;
          const shelfY = REMARKS_TOP - 4 + r.lane * 6;
          return (
            <g key={`rem-${r.minute}-${r.lane}`}>
              <line
                x1={r.x}
                x2={r.x}
                y1={startY}
                y2={shelfY}
                stroke={STATUS_INK}
                strokeWidth={1.0}
              />
              <line
                x1={r.x}
                x2={r.x + 12}
                y1={shelfY}
                y2={shelfY}
                stroke={STATUS_INK}
                strokeWidth={1.0}
              />
              <g transform={`translate(${r.x + 14}, ${shelfY + 4}) rotate(40)`}>
                <text
                  x={0}
                  y={0}
                  fontSize={10.5}
                  fontWeight={600}
                  fill={STATUS_INK}
                >
                  {r.line1}
                </text>
                <text
                  x={0}
                  y={12}
                  fontSize={10}
                  fontStyle="italic"
                  fill={LABEL_INK}
                >
                  {r.line2}
                </text>
              </g>
            </g>
          );
        })}
      </g>

      {/* ---- right-edge "HOURS" totals column ---------------------------- */}
      <g>
        <text
          x={PLOT_X + PLOT_W + 14}
          y={GRID_TOP - 8}
          fontSize={10}
          fontWeight={700}
          letterSpacing={0.6}
          fill={HEADING_INK}
        >
          HOURS
        </text>
        {STATUS_ORDER.map((status, rIdx) => {
          const y = GRID_TOP + rIdx * ROW_H + ROW_H / 2 + 4;
          const value = dailyLog.totals[status as DutyStatus] ?? 0;
          return (
            <text
              key={`tot-${status}`}
              x={PLOT_X + PLOT_W + 14}
              y={y}
              fontSize={13}
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
              fontWeight={500}
              fill={STATUS_INK}
            >
              {value.toFixed(2)}
            </text>
          );
        })}
        {(() => {
          const sum =
            (dailyLog.totals.off ?? 0) +
            (dailyLog.totals.sleeper ?? 0) +
            (dailyLog.totals.driving ?? 0) +
            (dailyLog.totals.onduty ?? 0);
          const y = GRID_TOP + GRID_H + 14;
          return (
            <>
              <line
                x1={PLOT_X + PLOT_W + 10}
                x2={PLOT_X + PLOT_W + 96}
                y1={y - 14}
                y2={y - 14}
                stroke={GRID_LINE_BOLD}
              />
              <text
                x={PLOT_X + PLOT_W + 14}
                y={y}
                fontSize={11}
                fontWeight={700}
                letterSpacing={0.5}
                fill={HEADING_INK}
              >
                TOTAL
              </text>
              <text
                x={PLOT_X + PLOT_W + 14}
                y={y + 16}
                fontSize={14}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
                fontWeight={700}
                fill={STATUS_INK}
              >
                {sum.toFixed(2)}
              </text>
            </>
          );
        })()}
      </g>

      {/* ---- hit zones for hover/aria ----------------------------------- */}
      <g>
        {sortedEvents.map((ev, i) => {
          const r = rowForStatus(ev.status);
          const x1 = minuteToX(ev.start_minute);
          const x2 = minuteToX(ev.end_minute);
          const label = `${STATUS_LABEL_SHORT[ev.status]} from ${fmtClock(
            ev.start_minute,
          )} to ${fmtClock(ev.end_minute)}${
            ev.location ? ` at ${ev.location}` : ""
          }${ev.note ? ` — ${ev.note}` : ""}`;
          return (
            <rect
              key={`hit-${i}`}
              role="img"
              aria-label={label}
              x={x1}
              y={GRID_TOP + r * ROW_H}
              width={Math.max(0, x2 - x1)}
              height={ROW_H}
              fill="transparent"
              onMouseEnter={() => setHoverRow(r)}
              onMouseLeave={() => setHoverRow(null)}
              style={{ cursor: "default" }}
            >
              <title>{label}</title>
            </rect>
          );
        })}
      </g>
    </svg>
  );
}

// --------------------------------------------------------------------------
//  Remarks builder + anti-overlap lanes
// --------------------------------------------------------------------------

interface Remark {
  minute: number;
  x: number;
  line1: string; // event description (e.g., "Pickup", "30-min break")
  line2: string; // location label
  lane: number; // 0 = closest to grid; higher = further down
}

function buildRemarks(events: StatusEvent[]): Remark[] {
  // Pick only notable transitions: pickup/dropoff/fuel/break_30/rest_10/restart_34.
  // Also include the very first event of the day if it's an onduty/driving start
  // (e.g., "Start" at 08:00).
  const notable: StatusEvent[] = [];
  for (const ev of events) {
    if (ev.stop_kind && ev.stop_kind !== "start") notable.push(ev);
  }
  // also include the first non-off event as a "Trip start" if it has a note
  if (events.length > 0 && events[0].stop_kind === "" && events[0].note) {
    notable.unshift(events[0]);
  }

  const remarks: Remark[] = [];
  const minSpacingPx = 78; // approx label width budget; below this -> next lane
  // We compute x by mapping minute to position. We'll let the caller use minuteToX.
  // But buildRemarks is pure of layout; instead we emit minute + relative x.

  const laneEndX: number[] = [];
  for (const ev of notable) {
    const x = (ev.start_minute / 1440) * 100; // 0..100 percentage anchor
    const xPx = (x / 100) * (VB_W - PAD_LEFT - PAD_RIGHT); // approx px width
    let lane = 0;
    while (lane < laneEndX.length && xPx < laneEndX[lane] + minSpacingPx) lane++;
    if (lane === laneEndX.length) laneEndX.push(xPx);
    else laneEndX[lane] = xPx;

    const line1 = STOP_KIND_REMARK[ev.stop_kind] || ev.note || "Event";
    const line2 = trimLocation(ev.location || "");
    remarks.push({
      minute: ev.start_minute,
      x: PLOT_X + (ev.start_minute / 1440) * PLOT_W,
      line1,
      line2,
      lane,
    });
  }
  return remarks;
}

function trimLocation(loc: string): string {
  if (loc.length <= 28) return loc;
  return loc.slice(0, 26) + "…";
}

export default LogGrid;
