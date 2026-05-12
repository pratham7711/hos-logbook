import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listTrips } from "@/api/trips";
import { fmtMiles } from "@/lib/format";
import { ArrowRight, Plus } from "lucide-react";

export function TripsListPage() {
  const { data, isLoading } = useQuery({ queryKey: ["trips"], queryFn: listTrips });
  const items = data?.results ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recent trips</h1>
        <Link
          to="/plan"
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-fg)]"
        >
          <Plus className="h-4 w-4" /> New trip
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[var(--border)] p-12 text-center text-[var(--fg-muted)]">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-[var(--fg-muted)]">No trips yet.</p>
          <Link
            to="/plan"
            className="mt-3 inline-flex items-center gap-1.5 text-[var(--accent)] font-medium"
          >
            Plan your first <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((t) => (
            <li key={t.id}>
              <Link
                to={`/trip/${t.id}`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4 hover:border-[var(--accent)] hover:shadow-soft transition"
              >
                <div className="flex items-center gap-2 flex-wrap text-[var(--fg)]">
                  <span className="font-medium">{t.current_location.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--fg-faint)]" />
                  <span className="font-medium">{t.pickup_location.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[var(--fg-faint)]" />
                  <span className="font-medium">{t.dropoff_location.label}</span>
                </div>
                <div className="mt-1 text-xs text-[var(--fg-muted)] font-mono">
                  {new Date(t.created_at).toLocaleString()} ·{" "}
                  {t.total_miles ? fmtMiles(Number(t.total_miles)) : "—"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
