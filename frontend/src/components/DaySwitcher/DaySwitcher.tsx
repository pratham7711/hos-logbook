import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";

import type { DailyLog } from "@/types/api";
import { cn } from "@/lib/cn";

interface DaySwitcherProps {
  days: DailyLog[];
  selectedDate: string; // YYYY-MM-DD
  onSelect: (d: string) => void;
}

interface DayMeta {
  date: string;
  weekday: string;
  monthDay: string;
  driveHrs: number;
  miles: number;
}

const formatLabel = (iso: string): { weekday: string; monthDay: string } => {
  // Parse YYYY-MM-DD as a calendar date (avoid TZ slippage).
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return {
    weekday: dt.toLocaleDateString(undefined, { weekday: "short" }),
    monthDay: dt.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
  };
};

export function DaySwitcher({ days, selectedDate, onSelect }: DaySwitcherProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const meta = useMemo<DayMeta[]>(
    () =>
      days.map((d) => {
        const { weekday, monthDay } = formatLabel(d.log_date);
        // backend serializes totals as HOURS (float), not minutes
        const driveHrs = d.totals?.driving ?? 0;
        return {
          date: d.log_date,
          weekday,
          monthDay,
          driveHrs,
          miles: d.total_miles ?? 0,
        };
      }),
    [days]
  );

  const selectedIdx = Math.max(
    0,
    meta.findIndex((d) => d.date === selectedDate)
  );

  // Animate the sliding indicator under the active pill.
  // useLayoutEffect runs before paint so the first frame is correct.
  useLayoutEffect(() => {
    const indicator = indicatorRef.current;
    const container = containerRef.current;
    const pill = pillRefs.current[selectedIdx];
    if (!indicator || !container || !pill) return;

    const containerBox = container.getBoundingClientRect();
    const pillBox = pill.getBoundingClientRect();
    const x = pillBox.left - containerBox.left + container.scrollLeft;
    const w = pillBox.width;

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    gsap.to(indicator, {
      x,
      width: w,
      duration: reduce ? 0 : 0.22,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, [selectedIdx, meta.length]);

  // Keep the selected pill in view when it changes (e.g. via arrow keys).
  useEffect(() => {
    const pill = pillRefs.current[selectedIdx];
    if (!pill) return;
    pill.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedIdx]);

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (meta.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(meta.length - 1, selectedIdx + 1);
      onSelect(meta[next].date);
      pillRefs.current[next]?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(0, selectedIdx - 1);
      onSelect(meta[prev].date);
      pillRefs.current[prev]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      onSelect(meta[0].date);
      pillRefs.current[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = meta.length - 1;
      onSelect(meta[last].date);
      pillRefs.current[last]?.focus();
    }
  };

  if (meta.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Trip days"
      onKeyDown={handleKey}
      className={cn(
        "relative flex gap-2 overflow-x-auto",
        "px-1 py-1",
        "scrollbar-none"
      )}
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
    >
      {/* Hide WebKit scrollbar */}
      <style>{`
        [role="tablist"]::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Sliding indicator (absolutely positioned, animated via GSAP) */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        className="absolute top-1 left-0 h-[calc(100%-0.5rem)] rounded-xl bg-[var(--accent)] pointer-events-none"
        style={{ width: 0, transform: "translateX(0)" }}
      />

      {meta.map((d, i) => {
        const active = i === selectedIdx;
        return (
          <button
            key={d.date}
            ref={(el) => {
              pillRefs.current[i] = el;
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(d.date)}
            className={cn(
              "relative z-[1] shrink-0 rounded-xl px-3.5 py-2 text-left",
              "transition-colors duration-200",
              "border border-transparent",
              active
                ? "text-[var(--accent-fg)]"
                : "text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg)]"
            )}
          >
            <div className="flex items-baseline gap-1.5">
              <span className={cn("text-[11px] font-medium uppercase tracking-wide opacity-80")}>
                {d.weekday}
              </span>
              <span className="text-sm font-semibold">{d.monthDay}</span>
            </div>
            <div
              className={cn(
                "mt-0.5 text-[11px] tabular-nums",
                active ? "opacity-90" : "opacity-70"
              )}
            >
              {d.driveHrs.toFixed(1)}h &middot; {Math.round(d.miles)}mi
            </div>
          </button>
        );
      })}
    </div>
  );
}
