import { TripForm } from "@/components/TripForm/TripForm";
import { Clock, Map, FileDown } from "lucide-react";

export function PlanPage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:gap-16 items-start">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--fg-muted)] mb-3">
          FMCSA Trip Planner
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-[var(--fg)] leading-[1.05]">
          Plan a trip.<br />
          We&apos;ll plan your stops <span className="text-[var(--accent)]">and your logs.</span>
        </h1>
        <p className="mt-5 text-[var(--fg-muted)] max-w-prose">
          Enter the four trip details below. We&apos;ll compute an HOS-compliant route with breaks,
          rests, and fuel stops, and auto-draw your daily ELD log sheets.
        </p>

        <div className="mt-10">
          <TripForm />
        </div>
      </div>

      <aside className="hidden lg:flex flex-col gap-3 w-72 mt-16">
        <SidebarPoint icon={<Map className="h-4 w-4" />} title="Route + stops">
          Truck-aware routing with fuel stops every 1,000 mi and 1 hr each for pickup/dropoff.
        </SidebarPoint>
        <SidebarPoint icon={<Clock className="h-4 w-4" />} title="Live HOS clocks">
          11-hr drive, 14-hr window, 30-min break, 70-hr/8-day cycle &mdash; enforced strictly.
        </SidebarPoint>
        <SidebarPoint icon={<FileDown className="h-4 w-4" />} title="Daily log PDFs">
          One sheet per day &mdash; FMCSA paper-log layout, downloadable as PDF.
        </SidebarPoint>
      </aside>
    </div>
  );
}

function SidebarPoint({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--bg-elev)] border border-[var(--border)] p-4">
      <div className="flex items-center gap-2 text-[var(--fg)] font-medium">
        <span className="text-[var(--accent)]">{icon}</span>
        {title}
      </div>
      <p className="mt-1.5 text-sm text-[var(--fg-muted)] leading-relaxed">{children}</p>
    </div>
  );
}
