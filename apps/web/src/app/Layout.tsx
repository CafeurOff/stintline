import { Link, NavLink, Outlet } from "react-router";

import { ApiStatus } from "@/features/health/ApiStatus";

import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { to: "/", label: "Races", end: true },
  { to: "/model", label: "Model", end: false },
];

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2.5">
          <Link to="/" className="group flex items-center gap-2 text-lg font-bold tracking-tight">
            <span
              aria-hidden="true"
              className="h-5 w-1.5 -skew-x-12 rounded-sm bg-accent transition group-hover:h-6"
            />
            StintLine
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                    isActive ? "bg-raised text-text" : "text-text-muted hover:text-text"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block">
              <ApiStatus />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16">
        <Outlet />
      </main>
      <footer className="border-t border-border px-4 py-5 text-center text-xs text-text-muted">
        Unofficial project, not associated with Formula 1, the FIA or any team. Data: OpenF1,
        Jolpica.
      </footer>
    </div>
  );
}
