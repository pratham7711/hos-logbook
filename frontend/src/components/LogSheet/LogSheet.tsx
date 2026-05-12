import type { DailyLog, TripDetail } from "@/types/api";
import { cn } from "@/lib/cn";
import { useUiStore } from "@/store/uiStore";
import { LogGrid } from "../LogGrid/LogGrid";
import { RecapTable } from "./RecapTable";

interface LogSheetProps {
  dailyLog: DailyLog;
  trip: TripDetail;
  /** All daily logs in the trip — required for the 7-day recap. */
  allDays?: DailyLog[];
  className?: string;
}

/**
 * A "paper-faithful" FMCSA daily log sheet. Includes header fields (driver's
 * signature, co-driver, vehicle numbers, mileage today, end date, operating
 * center, carrier address), the 24-hour grid with bottom hour labels + red
 * dot transition vertices, leader-line + rotated remarks, and a footer with
 * shipper / commodity / load number.
 */
export function LogSheet({ dailyLog, trip, allDays, className }: LogSheetProps) {
  const officer = useUiStore((s) => s.officerView);
  const days = allDays ?? trip.daily_logs ?? [];
  const month = new Date(dailyLog.log_date).toLocaleString(undefined, {
    month: "short",
  });
  const day = String(new Date(dailyLog.log_date).getDate()).padStart(2, "0");
  const year = new Date(dailyLog.log_date).getFullYear();

  const truck = trip.truck_number?.trim() || "—";
  const carrier = trip.carrier_name?.trim() || "Acme Trucking Co.";
  const driver = trip.driver_name?.trim() || "Driver";
  const totalMiles = dailyLog.total_miles ?? 0;
  const homeCenter = pickupOrCurrent(trip);

  return (
    <article
      className={cn(
        "rounded-2xl border print-page overflow-hidden",
        "flex flex-col",
        className,
      )}
      style={{
        background: "var(--bg-elev)",
        borderColor: "var(--border)",
        boxShadow:
          "0 1px 2px rgba(15, 19, 32, 0.04), 0 8px 32px -12px rgba(15, 19, 32, 0.08)",
      }}
      aria-label={`Daily log for ${dailyLog.log_date}`}
    >
      {/* ===== Header: paper-log fields ===== */}
      <header
        className="px-6 md:px-8 pt-6 pb-3 grid gap-3"
        style={{
          background:
            "linear-gradient(180deg, var(--bg-elev), var(--bg-elev))",
        }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              Driver's Daily Log
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--fg)] mt-0.5">
              {new Date(dailyLog.log_date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
              Original — Driver retains in possession for 8 days
            </p>
            <p className="text-[11px] text-[var(--fg-muted)] font-mono">
              24 hr / period · 70 hr / 8 day cycle · Property-carrying
            </p>
          </div>
        </div>

        {/* Row 1: signature + co-driver + vehicle numbers + miles + end date */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-3 pt-2">
          <Field label="(DRIVER'S SIGNATURE IN FULL) I certify these entries are true and correct" span={6}>
            <span
              style={{
                fontFamily: '"Caveat", "Dancing Script", cursive',
                fontSize: "1.45rem",
                lineHeight: 1,
                color: "var(--fg)",
              }}
            >
              {driver}
            </span>
          </Field>
          <Field label="(NAME OF CO-DRIVER)" span={3}>
            <span className="text-[var(--fg-muted)] text-sm">—</span>
          </Field>
          <Field label="(TOTAL DRIVING MILES TODAY)" span={1.5}>
            <span className="font-mono tabular-nums text-[var(--fg)] text-sm font-medium">
              {Math.round(totalMiles)}
            </span>
          </Field>
          <Field label="(END DATE)" span={1.5}>
            <div className="flex gap-1.5 text-[var(--fg)] font-mono tabular-nums text-sm font-medium">
              <DateBox value={month} />
              <DateBox value={day} />
              <DateBox value={String(year).slice(2)} />
            </div>
          </Field>
        </div>

        {/* Row 2: home operating center + carrier + vehicle numbers */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-3">
          <Field label="(HOME OPERATING CENTER AND ADDRESS)" span={5}>
            <span className="text-[var(--fg)] text-sm">{homeCenter}</span>
          </Field>
          <Field label="VEHICLE NUMBERS (SHOW EACH UNIT)" span={4}>
            <div className="flex gap-2 items-baseline text-sm">
              <TruckSlot prefix="T" value={truck} />
              <TruckSlot prefix="T" value="—" />
              <TruckSlot prefix="T" value="—" />
            </div>
          </Field>
          <Field label="(TOTAL TRUCK MILEAGE TODAY)" span={3}>
            <span className="font-mono tabular-nums text-[var(--fg)] text-sm font-medium">
              {Math.round(totalMiles)}
            </span>
          </Field>
        </div>

        {/* Row 3: shipping document + inspections */}
        <div className="grid grid-cols-12 gap-x-6 gap-y-3">
          <Field label="SHIPPING DOCUMENT NUMBER (BOL / MANIFEST)" span={5}>
            <span className="font-mono tabular-nums text-[var(--fg)] text-sm">
              BOL-{trip.id.slice(0, 8).toUpperCase()}
            </span>
          </Field>
          <Field label="PRE-TRIP / POST-TRIP INSPECTION (§396.13)" span={7}>
            <div className="flex items-center gap-3 text-sm text-[var(--fg)]">
              <Pip checked /> Pre-trip
              <Pip checked={(dailyLog.totals.driving ?? 0) > 0} /> Post-trip
              <span className="text-[var(--fg-muted)] text-xs">
                · No defects affecting safe operation
              </span>
            </div>
          </Field>
        </div>

        {/* Carrier line */}
        <div className="pt-1">
          <span className="font-semibold text-[var(--fg)]">{carrier}</span>
          <span className="text-[var(--fg-muted)] text-sm">
            {" "}
            · Safety records maintained at {homeCenter}
          </span>
        </div>
      </header>

      {/* ===== Grid ===== */}
      <div
        className="px-2 md:px-4 -mx-1 md:-mx-2 overflow-x-auto"
        style={{ background: "var(--bg-elev)" }}
      >
        <div className="min-w-[980px]">
          <LogGrid dailyLog={dailyLog} width={1100} height={460} className="w-full h-auto" monochrome={officer} />
        </div>
      </div>

      {/* ===== 7-day Recap (§395.8(j)) ===== */}
      <div className="px-6 md:px-8 pb-4">
        <RecapTable dailyLog={dailyLog} allDays={days} />
      </div>

      {/* ===== Footer: shipper / commodity / load + totals ===== */}
      <footer
        className="px-6 md:px-8 pb-6 pt-3 grid grid-cols-12 gap-x-6 gap-y-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <Field label="SHIPPER" span={4}>
          <span className="text-[var(--fg)] text-sm font-medium">
            {trip.pickup_location?.label || "—"}
          </span>
        </Field>
        <Field label="COMMODITY" span={3}>
          <span className="text-[var(--fg)] text-sm">General freight</span>
        </Field>
        <Field label="LOAD NO." span={2}>
          <span className="font-mono tabular-nums text-[var(--fg)] text-sm font-medium">
            {trip.id.slice(0, 8).toUpperCase()}
          </span>
        </Field>
        <Field label="TOTALS · 24.00 HR" span={3}>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] font-mono tabular-nums text-[var(--fg)]">
            <Total label="Off" v={dailyLog.totals.off ?? 0} />
            <Total label="SB" v={dailyLog.totals.sleeper ?? 0} />
            <Total label="D" v={dailyLog.totals.driving ?? 0} />
            <Total label="ON" v={dailyLog.totals.onduty ?? 0} />
          </div>
        </Field>
      </footer>
    </article>
  );
}

// ---- small layout primitives ---------------------------------------------

function Field({
  label,
  span,
  children,
}: {
  label: string;
  span: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col"
      style={{ gridColumn: `span ${Math.max(1, Math.round(span * 2))} / span ${Math.max(1, Math.round(span * 2))}` }}
    >
      <div
        className="min-h-[1.75rem] flex items-end pb-1 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {children}
      </div>
      <span className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--fg-faint)] mt-1 leading-tight">
        {label}
      </span>
    </div>
  );
}

function DateBox({ value }: { value: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-7 rounded border text-[12px]"
      style={{ borderColor: "var(--border)", background: "var(--bg-sunken)" }}
    >
      {value}
    </span>
  );
}

function TruckSlot({ prefix, value }: { prefix: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 text-[var(--fg-muted)]">
      <span className="text-[var(--fg-faint)]">{prefix}</span>
      <span className="font-mono tabular-nums text-[var(--fg)]">{value}</span>
    </span>
  );
}

function Pip({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded border text-[10px]",
        checked
          ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]"
          : "bg-transparent text-[var(--fg-faint)] border-[var(--border)]",
      )}
      aria-checked={checked}
      role="checkbox"
    >
      {checked ? "✓" : ""}
    </span>
  );
}

function Total({ label, v }: { label: string; v: number }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] text-[var(--fg-faint)] uppercase tracking-wide">
        {label}
      </span>
      <span className="font-medium">{v.toFixed(2)}</span>
    </span>
  );
}

function pickupOrCurrent(trip: TripDetail): string {
  return (
    trip.pickup_location?.label ||
    trip.current_location?.label ||
    "—"
  );
}

export default LogSheet;
