import type { DailyLog } from "@/types/api";
import { cn } from "@/lib/cn";

interface RecapTableProps {
  dailyLog: DailyLog;
  allDays: DailyLog[];
  className?: string;
}

/**
 * 7-day rolling recap (FMCSA §395.8(j)).
 *
 * Shows on-duty totals for "today" + the prior 6 days, the 7-day sum, and
 * available hours tomorrow (70 - 7-day total) under the 70 hr / 8 day rule.
 *
 * "On-duty" = driving + onduty(not driving) per §395.2. Off and sleeper
 * don't count toward the cycle.
 */
export function RecapTable({ dailyLog, allDays, className }: RecapTableProps) {
  const idx = allDays.findIndex((d) => d.log_date === dailyLog.log_date);
  // For each of last 7 days (today + 6 prior), look up the on-duty hours in the
  // trip's daily_logs if available, otherwise show 0. Real-world this would
  // pull from a long-term log store; here the trip is the only source.
  const slots: { label: string; date: string | null; onDuty: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const ref = idx - i;
    const d = ref >= 0 ? allDays[ref] : null;
    const onDuty = d ? (d.totals.driving ?? 0) + (d.totals.onduty ?? 0) : 0;
    slots.push({
      label: i === 0 ? "Today" : `${i}d ago`,
      date: d?.log_date ?? null,
      onDuty,
    });
  }
  const total7day = slots.reduce((acc, s) => acc + s.onDuty, 0);
  const availableTomorrow = Math.max(0, 70 - total7day);

  return (
    <section
      className={cn(
        "rounded-xl border p-4 grid gap-3",
        className,
      )}
      style={{ borderColor: "var(--border)", background: "var(--bg-sunken)" }}
      aria-label="7-day recap (FMCSA §395.8(j))"
    >
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
            7-day Recap · FMCSA §395.8(j)
          </p>
          <p className="text-sm text-[var(--fg-muted)]">
            Rolling 70 hr / 8 day on-duty total
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-faint)]">
            Hours available tomorrow
          </p>
          <p
            className={cn(
              "font-mono tabular-nums text-2xl font-semibold",
              availableTomorrow <= 0
                ? "text-[var(--danger)]"
                : availableTomorrow < 10
                  ? "text-[var(--amber)]"
                  : "text-[var(--fg)]",
            )}
          >
            {availableTomorrow.toFixed(2)} hr
          </p>
        </div>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[var(--fg-faint)]">
            {slots.map((s) => (
              <th key={s.label} className="py-1.5 text-left font-medium">
                {s.label}
              </th>
            ))}
            <th className="py-1.5 text-right font-semibold text-[var(--fg-muted)]">
              7-day total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-[var(--fg)] font-mono tabular-nums">
            {slots.map((s, i) => (
              <td
                key={i}
                className={cn(
                  "py-1.5",
                  i === 0 && "font-semibold text-[var(--fg)]",
                )}
              >
                {s.date ? s.onDuty.toFixed(2) : <span className="text-[var(--fg-faint)]">—</span>}
              </td>
            ))}
            <td className="py-1.5 text-right font-semibold">
              {total7day.toFixed(2)} / 70.00
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

export default RecapTable;
