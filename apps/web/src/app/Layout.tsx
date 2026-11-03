import { Link, Outlet } from "react-router";

import { ApiStatus } from "@/features/health/ApiStatus";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only bg-surface-raised focus:not-sr-only focus:absolute focus:p-2"
      >
        Skip to content
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            StintLine
          </Link>
          <ApiStatus />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4">
        <Outlet />
      </main>
      <footer className="border-t border-border px-4 py-4 text-center text-xs text-text-muted">
        Unofficial project, not associated with Formula 1, the FIA or any team. Data: OpenF1,
        Jolpica.
      </footer>
    </div>
  );
}
