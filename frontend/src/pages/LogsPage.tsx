import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { getTrip } from "@/api/trips";
import { LogSheet } from "@/components/LogSheet/LogSheet";
import { DaySwitcher } from "@/components/DaySwitcher/DaySwitcher";
import { pdfUrl } from "@/api/client";
import { FileDown, ArrowLeft } from "lucide-react";

export function LogsPage() {
  const { id, date } = useParams();
  const navigate = useNavigate();

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id!),
    enabled: !!id,
  });

  const activeDate = date ?? trip?.daily_logs[0]?.log_date;
  useEffect(() => {
    if (trip && !date) {
      const first = trip.daily_logs[0]?.log_date;
      if (first) navigate(`/trip/${id}/logs/${first}`, { replace: true });
    }
  }, [trip, date, id, navigate]);

  if (isLoading || !trip) {
    return <div className="h-screen grid place-items-center text-[var(--fg-muted)]">Loading…</div>;
  }

  const activeDay = trip.daily_logs.find((d) => d.log_date === activeDate) ?? trip.daily_logs[0];

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link to={`/trip/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          <ArrowLeft className="h-4 w-4" /> Back to trip
        </Link>
        <a
          href={pdfUrl(`/trips/${trip.id}/logs.pdf`)}
          target="_blank"
          rel="noreferrer"
          className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-[var(--accent-fg)]"
        >
          <FileDown className="h-4 w-4" /> Download all days
        </a>
      </div>

      <DaySwitcher
        days={trip.daily_logs}
        selectedDate={activeDate ?? ""}
        onSelect={(d) => navigate(`/trip/${id}/logs/${d}`)}
      />

      {activeDay && <LogSheet dailyLog={activeDay} trip={trip} allDays={trip.daily_logs} />}
    </div>
  );
}
