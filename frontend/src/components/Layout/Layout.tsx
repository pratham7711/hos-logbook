import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useUiStore } from "@/store/uiStore";
import { cn } from "@/lib/cn";
import { Moon, Sun, ShieldCheck, Truck } from "lucide-react";

export function Layout() {
  const { theme, toggleTheme, officerView, toggleOfficerView } = useUiStore();
  const location = useLocation();
  const onPlan = location.pathname === "/plan" || location.pathname === "/";

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30",
          "bg-[var(--bg)] border-b border-[var(--border)]",
        )}
      >
        <div className="mx-auto max-w-7xl flex items-center gap-6 px-5 sm:px-8 h-16">
          <Link to="/plan" className="flex items-center gap-2 group">
            <span className="grid place-items-center h-8 w-8 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)]">
              <Truck className="h-4 w-4" />
            </span>
            <span className="font-semibold tracking-tight text-[var(--fg)]">HOS Logbook</span>
            <span className="hidden sm:inline text-xs text-[var(--fg-faint)] -ml-1">
              · FMCSA Part 395
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 ml-2">
            <NavTab to="/plan" label="Plan" />
            <NavTab to="/trips" label="Trips" />
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleOfficerView}
              className={cn(
                "h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-1.5",
                officerView
                  ? "bg-[var(--fg)] text-[var(--bg)]"
                  : "text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)]",
              )}
              aria-pressed={officerView}
              title="Toggle Officer View"
            >
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Officer</span>
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 w-9 grid place-items-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)]"
              aria-label="Toggle theme"
              title={theme === "day" ? "Switch to night" : "Switch to day"}
            >
              {theme === "day" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className={cn("mx-auto max-w-7xl px-5 sm:px-8", onPlan ? "pt-10 pb-20" : "py-8")}>
        <Outlet />
      </main>

      <footer className="mx-auto max-w-7xl px-5 sm:px-8 py-8 text-xs text-[var(--fg-faint)]">
        Built for property-carrying drivers · 70 hr / 8 day cycle · No adverse conditions assumed
      </footer>
    </>
  );
}

function NavTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "h-9 px-3 rounded-lg text-sm font-medium",
          isActive
            ? "bg-[var(--bg-sunken)] text-[var(--fg)]"
            : "text-[var(--fg-muted)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg)]",
        )
      }
    >
      {label}
    </NavLink>
  );
}
