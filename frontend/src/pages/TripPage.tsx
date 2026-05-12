import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { getTrip } from "@/api/trips";
import { useUiStore } from "@/store/uiStore";
import { MapView } from "@/components/MapView/MapView";
import { LogSheet } from "@/components/LogSheet/LogSheet";
import { DaySwitcher } from "@/components/DaySwitcher/DaySwitcher";
import { TripSummary } from "@/components/TripSummary/TripSummary";
import { HOSClocks } from "@/components/HOSClocks/HOSClocks";
import { pdfUrl } from "@/api/client";
import { FileDown, FileText, AlertTriangle } from "lucide-react";

export function TripPage() {
  const { id } = useParams();
  const { selectedDate, setSelectedDate } = useUiStore();

  const { data: trip, isLoading, error } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id!),
    enabled: !!id,
  });

  const days = useMemo(() => trip?.daily_logs ?? [], [trip]);
  const activeDate = selectedDate && days.find((d) => d.log_date === selectedDate)
    ? selectedDate
    : days[0]?.log_date;

  useEffect(() => {
    if (activeDate && activeDate !== selectedDate) setSelectedDate(activeDate);
  }, [activeDate, selectedDate, setSelectedDate]);

  if (isLoading) return <TripSkeleton />;
  if (error || !trip) {
    return (
      <div className="rounded-2xl border border-[var(--border)] p-8 bg-[var(--bg-elev)]">
        <div className="flex items-center gap-2 text-[var(--danger)] font-medium">
          <AlertTriangle className="h-4 w-4" /> Could not load this trip.
        </div>
        <Link to="/plan" className="mt-3 inline-block text-sm text-[var(--accent)]">
          ← Plan a new trip
        </Link>
      </div>
    );
  }

  const activeDay = days.find((d) => d.log_date === activeDate) ?? days[0];

  return (
    <div className="grid gap-6">
      <TripSummary trip={trip} />
      <HOSClocks trip={trip} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MapView trip={trip} className="h-[460px]" />
        </div>
        <div className="lg:col-span-2 rounded-2xl bg-[var(--bg-elev)] border border-[var(--border)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold tracking-tight">Stops</h2>
            <span className="text-xs text-[var(--fg-muted)]">{trip.stops.length} markers</span>
          </div>
          <ul className="mt-3 max-h-[400px] overflow-y-auto pr-1 divide-y divide-[var(--border)]">
            {trip.stops.map((s) => (
              <li
                key={s.sequence}
                className="py-2.5 flex items-start gap-3 text-sm"
              >
                <StopChip kind={s.kind} />
                <div className="min-w-0">
                  <div className="truncate text-[var(--fg)]">{s.label}</div>
                  <div className="text-xs text-[var(--fg-muted)] font-mono">
                    Mile {s.mile_marker.toFixed(0)} · {new Date(s.arrive_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--bg-elev)] border border-[var(--border)] p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold tracking-tight">Daily logs</h2>
          <div className="flex items-center gap-2">
            {activeDate && (
              <a
                href={pdfUrl(`/trips/${trip.id}/logs/${activeDate}/pdf`)}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-[var(--fg)] border border-[var(--border)] hover:bg-[var(--bg-sunken)]"
              >
                <FileText className="h-4 w-4" /> Day PDF
              </a>
            )}
            <a
              href={pdfUrl(`/trips/${trip.id}/logs.pdf`)}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-fg)]"
            >
              <FileDown className="h-4 w-4" /> Full trip PDF
            </a>
          </div>
        </div>

        <div className="mt-4">
          <DaySwitcher days={days} selectedDate={activeDate ?? days[0]?.log_date ?? ""} onSelect={setSelectedDate} />
        </div>

        {activeDay && (
          <div className="mt-5">
            <LogSheet dailyLog={activeDay} trip={trip} allDays={days} />
          </div>
        )}
      </div>
    </div>
  );
}

const KIND_COLORS: Record<string, string> = {
  start: "#22c55e",
  pickup: "#5b6cff",
  dropoff: "#ef4444",
  fuel: "#f59e0b",
  break_30: "#06b6d4",
  rest_10: "#8b5cf6",
  restart_34: "#f43f5e",
};

function StopChip({ kind }: { kind: string }) {
  return (
    <span
      className="mt-1 h-2.5 w-2.5 rounded-full shrink-0"
      style={{ backgroundColor: KIND_COLORS[kind] ?? "#9ca3af" }}
      aria-hidden
    />
  );
}

function TripSkeleton() {
  return (
    <div className="grid gap-6 animate-pulse">
      <div className="h-20 rounded-2xl bg-[var(--bg-sunken)]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-[var(--bg-sunken)]" />
        ))}
      </div>
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 h-[460px] rounded-2xl bg-[var(--bg-sunken)]" />
        <div className="lg:col-span-2 h-[460px] rounded-2xl bg-[var(--bg-sunken)]" />
      </div>
      <div className="h-80 rounded-2xl bg-[var(--bg-sunken)]" />
    </div>
  );
}
