import { Link, NavLink, Outlet, useMatch } from "react-router";

import { ApiStatus } from "@/features/health/ApiStatus";
import { useLiveStatus } from "@/features/live/api";
import { useSessionDetail } from "@/features/race/api";
import { RacePicker } from "@/features/session-picker/RacePicker";
import { useI18n } from "@/lib/i18n/context";

import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

const navLink = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 py-1 ${
    isActive ? "border-mark font-bold text-ink" : "border-transparent text-muted hover:text-ink"
  }`;

export function Layout() {
  const { t } = useI18n();
  const live = useLiveStatus().data?.state === "live";
  const tyres = useMatch("/sessions/:sessionId/tyres");
  const race = useMatch("/sessions/:sessionId");
  const raw = (tyres ?? race)?.params.sessionId;
  const sessionId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1360px] flex-col px-4 sm:px-6">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-panel px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("app.skip")}
      </a>
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold">
          <span aria-hidden="true" className="h-4 w-2 -skew-x-[16deg] bg-mark" />
          StintLine
        </Link>
        <nav
          aria-label={t("nav.label")}
          className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto px-4 md:order-none md:mx-0 md:w-auto md:px-0"
        >
          <NavLink to="/live" className={navLink}>
            <span className="inline-flex items-center gap-1.5">
              {live && <span aria-hidden="true" className="size-2 rounded-full bg-mark" />}
              {t("nav.live")}
              {live && <span className="sr-only"> ({t("live.now")})</span>}
            </span>
          </NavLink>
          <NavLink to="/calendar" className={navLink}>
            {t("nav.calendar")}
          </NavLink>
          <NavLink to="/drivers" className={navLink}>
            {t("nav.drivers")}
          </NavLink>
          <NavLink to="/teams" className={navLink}>
            {t("nav.teams")}
          </NavLink>
          <NavLink to="/news" className={navLink}>
            {t("nav.news")}
          </NavLink>
          <NavLink to="/standings" className={navLink}>
            {t("nav.standings")}
          </NavLink>
          <NavLink to="/model" className={navLink}>
            {t("nav.model")}
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>
      {sessionId !== null && <RaceBar sessionId={sessionId} onTyres={tyres !== null} />}
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

/** Race context: which race, which view, and a link to the full Grand Prix page. */
function RaceBar({ sessionId, onTyres }: { sessionId: number; onTyres: boolean }) {
  const { t } = useI18n();
  const session = useSessionDetail(sessionId);
  const eventId = session.data?.event.id;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <RacePicker sessionId={sessionId} view={onTyres ? "/tyres" : ""} />
      <nav aria-label={t("nav.race")} className="flex gap-5">
        <NavLink to={`/sessions/${sessionId}`} end className={navLink}>
          {t("nav.circuit")}
        </NavLink>
        <NavLink to={`/sessions/${sessionId}/tyres`} className={navLink}>
          {t("nav.tyres")}
        </NavLink>
        {eventId !== undefined && (
          <NavLink to={`/events/${eventId}`} className={navLink}>
            {t("nav.event")}
          </NavLink>
        )}
      </nav>
    </div>
  );
}
