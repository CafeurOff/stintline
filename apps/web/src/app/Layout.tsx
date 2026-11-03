import { Link, NavLink, Outlet, useMatch } from "react-router";

import { ApiStatus } from "@/features/health/ApiStatus";
import { RaceSelect } from "@/features/session-picker/RaceSelect";
import { useI18n } from "@/lib/i18n/context";

import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

export function Layout() {
  const { t } = useI18n();
  const tyres = useMatch("/sessions/:sessionId/tyres");
  const race = useMatch("/sessions/:sessionId");
  const raw = (tyres ?? race)?.params.sessionId;
  const sessionId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const navLink = ({ isActive }: { isActive: boolean }) =>
    `py-1 ${isActive ? "font-bold text-ink" : "text-muted hover:text-ink"}`;

  return (
    <div className="flex min-h-screen flex-col px-4">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-panel px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("app.skip")}
      </a>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true" className="h-4 w-2 -skew-x-[16deg] bg-mark" />
          StintLine
        </Link>
        {sessionId !== null && <RaceSelect sessionId={sessionId} view={tyres ? "/tyres" : ""} />}
        <nav aria-label={t("nav.label")} className="flex gap-5">
          {sessionId !== null ? (
            <>
              <NavLink to={`/sessions/${sessionId}`} end className={navLink}>
                {t("nav.race")}
              </NavLink>
              <NavLink to={`/sessions/${sessionId}/tyres`} className={navLink}>
                {t("nav.tyres")}
              </NavLink>
            </>
          ) : (
            <NavLink to="/" end className={navLink}>
              {t("nav.race")}
            </NavLink>
          )}
          <NavLink to="/model" className={navLink}>
            {t("nav.model")}
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 pb-8">
        <Outlet />
      </main>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-line py-4 text-sm text-muted">
        <span>{t("app.disclaimer")}</span>
        <ApiStatus />
      </footer>
    </div>
  );
}
