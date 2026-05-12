import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Clock,
  Gauge,
  MapPin,
} from "lucide-react";
import type { TripDetail } from "@/types/api";
import { cn } from "@/lib/cn";
import { fmtHours, fmtMiles } from "@/lib/format";

interface TripSummaryProps {
  trip: TripDetail;
}

const formatEta = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function TripSummary({ trip }: TripSummaryProps) {
  const [violationsOpen, setViolationsOpen] = useState(false);
  const violations = trip.violations ?? [];
  const hasViolations = violations.length > 0;

  return (
    <section
      className="rounded-2xl bg-[var(--bg-elev)] border border-[var(--border)] shadow-soft"
      aria-label="Trip summary"
    >
      <div className="p-5 flex flex-wrap gap-x-8 gap-y-4 items-center">
        {/* Route */}
        <div className="flex items-center gap-2 min-w-0">
          <MapPin
            className="h-4 w-4 text-[var(--fg-faint)] shrink-0"
            aria-hidden="true"
          />
          <RouteLabel label={trip.current_location?.label || "Current"} />
          <ArrowRight
            className="h-3.5 w-3.5 text-[var(--fg-faint)] shrink-0"
            aria-hidden="true"
          />
          <RouteLabel label={trip.pickup_location?.label || "Pickup"} />
          <ArrowRight
            className="h-3.5 w-3.5 text-[var(--fg-faint)] shrink-0"
            aria-hidden="true"
          />
          <RouteLabel
            label={trip.dropoff_location?.label || "Dropoff"}
            emphasis
          />
        </div>

        <Stat
          icon={<Gauge className="h-4 w-4" aria-hidden="true" />}
          label="Total miles"
          value={fmtMiles(trip.summary?.total_miles ?? 0)}
        />
        <Stat
          icon={<Clock className="h-4 w-4" aria-hidden="true" />}
          label="Drive time"
          value={fmtHours(trip.summary?.total_drive_hours ?? 0)}
        />
        <Stat
          icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
          label="ETA"
          value={formatEta(trip.summary?.eta ?? null)}
        />
        <Stat
          label="Days"
          value={`${trip.summary?.days_required ?? 0}`}
        />

        {hasViolations && (
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setViolationsOpen((v) => !v)}
              aria-expanded={violationsOpen}
              aria-controls="trip-violations-list"
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5",
                "text-xs font-medium",
                "bg-[var(--amber)]/15 text-[var(--amber)]",
                "border border-[var(--amber)]/40",
                "hover:bg-[var(--amber)]/25",
              )}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Plan adjusted ({violations.length})
            </button>
          </div>
        )}
      </div>

      {hasViolations && violationsOpen && (
        <div
          id="trip-violations-list"
          className={cn(
            "border-t border-[var(--border)] px-5 py-4",
            "animate-fade-up",
          )}
        >
          <p className="text-xs uppercase tracking-wide text-[var(--fg-muted)] mb-2">
            Compliance adjustments
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--fg)]">
            {violations.map((v, i) => (
              <li key={i} className="flex gap-2">
                <AlertTriangle
                  className="h-4 w-4 mt-0.5 shrink-0 text-[var(--amber)]"
                  aria-hidden="true"
                />
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function RouteLabel({
  label,
  emphasis,
}: {
  label: string;
  emphasis?: boolean;
}) {
  return (
    <span
      className={cn(
        "truncate max-w-[12rem] sm:max-w-[16rem] text-sm",
        emphasis
          ? "font-semibold text-[var(--fg)]"
          : "font-medium text-[var(--fg)]",
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon && (
        <span className="text-[var(--fg-faint)]" aria-hidden="true">
          {icon}
        </span>
      )}
      <div className="leading-tight">
        <div className="text-[10px] uppercase tracking-wide text-[var(--fg-muted)]">
          {label}
        </div>
        <div className="text-sm font-mono tabular-nums font-semibold text-[var(--fg)]">
          {value}
        </div>
      </div>
    </div>
  );
}
