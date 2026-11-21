import { type ReactNode, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";

import { useLiveStatus } from "@/features/live/api";
import { RacePicker } from "@/features/race-picker/RacePicker";
import { useSessionDetail } from "@/features/race/api";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";
import { timeLeft, useClock } from "@/lib/useClock";

import { LanguageToggle } from "./LanguageToggle";
import { NavGroups, Wordmark } from "./Navigation";
import { ThemeToggle } from "./ThemeToggle";

const tabLink = ({ isActive }: { isActive: boolean }) =>
  `flex h-12 shrink-0 items-center border-b-2 font-semibold ${
    isActive ? "border-mark text-ink" : "border-transparent text-muted hover:text-ink"
  }`;

/**
 * The bar above every page: the race context on race pages (picker and views), the next
 * session or the live state on the right. On phones it also carries the brand and the menu.
 */
export function ContextBar({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-x-4 px-4 sm:px-8">
        <div className="flex h-14 items-center lg:hidden">
          <Wordmark />
        </div>
        <div className="ml-auto flex h-14 items-center gap-2 lg:order-2">
          <NextSession />
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? t("nav.close") : t("nav.menu")}
            onClick={() => {
              setOpenOn(open ? null : pathname);
            }}
            className="inline-flex size-10 items-center justify-center hover:bg-raised lg:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </button>
        </div>
        {children && (
          <div className="-mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center gap-6 overflow-x-auto border-t border-line px-4 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8 lg:order-1 lg:mx-0 lg:w-auto lg:flex-1 lg:border-0 lg:px-0">
            {children}
          </div>
        )}
      </div>
      {open && (
        <nav
          id="site-menu"
          aria-label={t("nav.label")}
          className="max-h-[calc(100vh-3.5rem)] overflow-y-auto border-t border-line bg-panel pb-4 lg:hidden"
        >
          <NavGroups
            onPick={() => {
              setOpenOn(null);
            }}
          />
          <div className="mt-4 px-3">
            <LanguageToggle />
          </div>
        </nav>
      )}
    </header>
  );
}

/** "Live" while a session runs, otherwise the next session and the time left, in mono. */
function NextSession() {
  const { t, locale } = useI18n();
  const status = useLiveStatus().data;
  const now = useClock(30_000);
  if (status?.state === "live") {
    return (
      <Link to="/live" className="flex items-center gap-2 font-semibold text-mark-text">
        <span aria-hidden="true" className="kerb h-2.5 w-5" />
        {t("live.now")}
      </Link>
    );
  }
  const next = status?.next_session;
  if (!next) return null;
  const left = timeLeft(new Date(next.starts_at).getTime(), now);
  const when =
    left.days > 0
      ? t("header.inDays", { days: left.days, hours: left.hours })
      : t("header.inHours", { hours: left.hours, minutes: left.minutes });
  return (
    <Link to="/live" className="group hidden items-baseline gap-3 text-sm sm:flex">
      <span className="text-muted">
        {t("header.next")} · {sessionLabel(next.kind, t)} ·{" "}
        <span className="text-ink group-hover:underline">{eventName(next.event_name, locale)}</span>
      </span>
      <span className="num font-medium text-ink">{when}</span>
    </Link>
  );
}

/** Race context: which race, which view, and a link to the full Grand Prix page. */
export function RaceBar({ sessionId, onTyres }: { sessionId: number; onTyres: boolean }) {
  const { t } = useI18n();
  const session = useSessionDetail(sessionId);
  const eventId = session.data?.event.id;

  return (
    <>
      <RacePicker sessionId={sessionId} view={onTyres ? "/tyres" : ""} />
      <nav aria-label={t("nav.race")} className="flex gap-5">
        <NavLink to={`/sessions/${sessionId}`} end className={tabLink}>
          {t("nav.circuit")}
        </NavLink>
        {(session.data?.kind === "R" || session.data?.kind === "SPRINT") && (
          <NavLink to={`/sessions/${sessionId}/tyres`} className={tabLink}>
            {t("nav.tyres")}
          </NavLink>
        )}
        {eventId !== undefined && (
          <NavLink to={`/events/${eventId}`} className={tabLink}>
            {t("nav.event")}
          </NavLink>
        )}
      </nav>
    </>
  );
}
