import { useMemo, useState, type ReactNode } from "react";
import type { DailyLog, TripDetail } from "@/types/api";
import { cn } from "@/lib/cn";

interface HOSClocksProps {
  trip: TripDetail;
}

type ClockState = "ok" | "warn" | "over";

interface ClockCard {
  key: string;
  label: string;
  /** Big number text, already formatted. */
  value: string;
  /** Subtitle e.g. "of 11.0 hr". */
  caption: string;
  /** 0..1, clamped. */
  fill: number;
  state: ClockState;
  tooltip: string;
}

const RULE_DRIVE = 11; // 11-hour daily driving limit
const RULE_WINDOW = 14; // 14-hour daily on-duty window
const RULE_BREAK_AFTER = 8; // 30-min break required after 8 hr of driving
const RULE_CYCLE = 70; // 70-hour cycle (8-day rolling)

const stateBorder: Record<ClockState, string> = {
  ok: "border-[var(--border)]",
  warn: "border-[var(--amber)]",
  over: "border-[var(--danger)]",
};
const stateText: Record<ClockState, string> = {
  ok: "text-[var(--fg)]",
  warn: "text-[var(--amber)]",
  over: "text-[var(--danger)]",
};
const stateFill: Record<ClockState, string> = {
  ok: "bg-[var(--accent)]",
  warn: "bg-[var(--amber)]",
  over: "bg-[var(--danger)]",
};

/**
 * Heuristics for the four clocks (display-only; the planner has already
 * enforced compliance — these visualize the worst day's pressure on each rule).
 *
 *  1. 11-hr Drive    -> max(daily totals.driving). If > 11 in any day -> warn/over.
 *  2. 14-hr Window   -> max per-day (driving + onduty); compared to 14.
 *  3. Break in       -> longest continuous driving stretch without a break event,
 *                       across all daily logs. Compared to RULE_BREAK_AFTER (8 hr).
 *  4. 70-hr Cycle    -> cycle_used_hours (starting) + total_drive_hours, vs 70.
 */
const buildClocks = (trip: TripDetail): ClockCard[] => {
  const logs = trip.daily_logs ?? [];

  // 1) Daily driving hours -> max  (backend totals are already in HOURS)
  const driveHoursPerDay = logs.map((d) => d.totals?.driving ?? 0);
  const maxDrive = driveHoursPerDay.length ? Math.max(...driveHoursPerDay) : 0;

  // 2) Daily on-duty window (driving + onduty) -> max
  const windowHoursPerDay = logs.map(
    (d) => (d.totals?.driving ?? 0) + (d.totals?.onduty ?? 0),
  );
  const maxWindow = windowHoursPerDay.length
    ? Math.max(...windowHoursPerDay)
    : 0;

  // 3) Longest continuous driving stretch w/o a 30-min break
  const longestStretch = longestDrivingStretchHours(logs);

  // 4) Cycle used at ETA = starting cycle + total drive hours
  const startCycle = Number.parseFloat(trip.cycle_used_hours ?? "0") || 0;
  const cycleUsed = startCycle + (trip.summary?.total_drive_hours ?? 0);

  const stateFor = (used: number, max: number, warnAt: number): ClockState => {
    if (used > max) return "over";
    if (used >= warnAt) return "warn";
    return "ok";
  };

  return [
    {
      key: "drive",
      label: "11-hr Drive",
      value: `${maxDrive.toFixed(1)} hr`,
      caption: `of ${RULE_DRIVE.toFixed(1)} hr / day`,
      fill: clamp01(maxDrive / RULE_DRIVE),
      state: stateFor(maxDrive, RULE_DRIVE, RULE_DRIVE - 1),
      tooltip:
        "Drivers may drive a maximum of 11 hours after 10 consecutive hours off duty.",
    },
    {
      key: "window",
      label: "14-hr Window",
      value: `${maxWindow.toFixed(1)} hr`,
      caption: `of ${RULE_WINDOW.toFixed(1)} hr / day`,
      fill: clamp01(maxWindow / RULE_WINDOW),
      state: stateFor(maxWindow, RULE_WINDOW, RULE_WINDOW - 1),
      tooltip:
        "Driving is not permitted beyond the 14th consecutive hour after coming on duty.",
    },
    {
      key: "break",
      label: "Break in",
      value: `${longestStretch.toFixed(1)} hr`,
      caption: `after ${RULE_BREAK_AFTER} hr drive`,
      fill: clamp01(longestStretch / RULE_BREAK_AFTER),
      state: stateFor(longestStretch, RULE_BREAK_AFTER, RULE_BREAK_AFTER - 1),
      tooltip:
        "A 30-minute break is required after 8 cumulative hours of driving time.",
    },
    {
      key: "cycle",
      label: "70-hr Cycle",
      value: `${cycleUsed.toFixed(1)} hr`,
      caption: `of ${RULE_CYCLE} hr / 8 days`,
      fill: clamp01(cycleUsed / RULE_CYCLE),
      state: stateFor(cycleUsed, RULE_CYCLE, RULE_CYCLE - 5),
      tooltip:
        "Drivers may not exceed 70 hours on duty in any rolling 8-day period.",
    },
  ];
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Walk every daily log's events and find the longest continuous run of
 * `driving` (across days, since rest events reset the counter). A `break_30`
 * or `rest_10` event resets; anything else just adds to total off-driving.
 */
const longestDrivingStretchHours = (logs: DailyLog[]): number => {
  let best = 0;
  let current = 0; // in minutes
  for (const day of logs) {
    for (const ev of day.events ?? []) {
      const span = Math.max(0, ev.end_minute - ev.start_minute);
      if (ev.status === "driving") {
        current += span;
        if (current > best) best = current;
      } else if (
        ev.stop_kind === "break_30" ||
        ev.stop_kind === "rest_10" ||
        ev.stop_kind === "restart_34" ||
        ev.status === "sleeper" ||
        ev.status === "off"
      ) {
        current = 0;
      }
      // 'onduty' (non-driving) does not count as a 30-min break; keep current
    }
  }
  return best / 60;
};

export function HOSClocks({ trip }: HOSClocksProps) {
  const clocks = useMemo(() => buildClocks(trip), [trip]);

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4"
      role="group"
      aria-label="Hours of Service summary clocks"
    >
      {clocks.map((c) => (
        <ClockTile key={c.key} card={c} />
      ))}
    </div>
  );
}

function ClockTile({ card }: { card: ClockCard }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-[var(--bg-elev)] shadow-soft",
        "p-4 md:p-5 flex flex-col gap-3 select-none",
        stateBorder[card.state],
      )}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-label={`${card.label}: ${card.value}. ${card.tooltip}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-[var(--fg-muted)] uppercase tracking-wide">
          {card.label}
        </span>
        <StateDot state={card.state} />
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono tabular-nums text-2xl md:text-3xl font-semibold",
            stateText[card.state],
          )}
        >
          {card.value}
        </span>
      </div>
      <span className="text-xs text-[var(--fg-faint)] -mt-2">
        {card.caption}
      </span>

      <Bar fill={card.fill} state={card.state} />

      {open && (
        <Tooltip>
          <p className="font-medium text-[var(--fg)]">{card.label}</p>
          <p className="mt-1 text-[var(--fg-muted)]">{card.tooltip}</p>
        </Tooltip>
      )}
    </div>
  );
}

function Bar({ fill, state }: { fill: number; state: ClockState }) {
  return (
    <div className="h-1.5 rounded-full bg-[var(--bg-sunken)] overflow-hidden">
      <div
        className={cn("h-full rounded-full", stateFill[state])}
        style={{
          width: `${(fill * 100).toFixed(2)}%`,
          transform: "translateZ(0)",
          transition: "width 360ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      />
    </div>
  );
}

function StateDot({ state }: { state: ClockState }) {
  const color =
    state === "over"
      ? "bg-[var(--danger)]"
      : state === "warn"
        ? "bg-[var(--amber)]"
        : "bg-[var(--accent)]";
  return (
    <span
      className={cn("h-2 w-2 rounded-full", color)}
      aria-hidden="true"
    />
  );
}

function Tooltip({ children }: { children: ReactNode }) {
  return (
    <div
      role="tooltip"
      className={cn(
        "absolute z-10 left-3 right-3 -top-2 -translate-y-full",
        "rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]",
        "shadow-soft p-3 text-xs",
        "animate-fade-up",
      )}
    >
      {children}
    </div>
  );
}
