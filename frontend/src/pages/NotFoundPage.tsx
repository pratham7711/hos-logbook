import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="grid place-items-center min-h-[60vh] text-center">
      <div>
        <p className="font-mono text-sm text-[var(--fg-faint)] tracking-widest">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Wrong exit.</h1>
        <p className="mt-2 text-[var(--fg-muted)]">That page isn&apos;t on this route.</p>
        <Link
          to="/plan"
          className="mt-6 inline-flex h-10 px-4 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] items-center font-medium"
        >
          Plan a trip
        </Link>
      </div>
    </div>
  );
}
