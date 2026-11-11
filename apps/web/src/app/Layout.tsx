import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { ApiStatus } from "@/features/health/ApiStatus";
import { useLiveStatus } from "@/features/live/api";
import { useSessionDetail } from "@/features/race/api";
import { RacePicker } from "@/features/session-picker/RacePicker";
import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";
import { timeLeft, useClock } from "@/lib/useClock";

import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

const SECTIONS = [
  ["/calendar", "nav.calendar"],
  ["/drivers", "nav.drivers"],
  ["/teams", "nav.teams"],
  ["/standings", "nav.standings"],
  ["/news", "nav.news"],
  ["/model", "nav.model"],
] as const;

const navLink = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-full shrink-0 items-center px-1 text-sm font-semibold tracking-wide uppercase transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:-skew-x-[16deg] ${
    isActive ? "text-ink after:bg-mark" : "text-muted after:bg-transparent hover:text-ink"
  }`;

const tabLink = ({ isActive }: { isActive: boolean }) =>
  `shrink-0 border-b-2 py-1 font-semibold ${
    isActive ? "border-mark text-ink" : "border-transparent text-muted hover:text-ink"
  }`;

export function Layout() {
  const { t } = useI18n();
  const tyres = useMatch("/sessions/:sessionId/tyres");
  const race = useMatch("/sessions/:sessionId");
  const raw = (tyres ?? race)?.params.sessionId;
  const sessionId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-panel px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("app.skip")}
      </a>
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-[1360px] flex-1 flex-col px-4 pt-6 sm:px-6">
        {sessionId !== null && <RaceBar sessionId={sessionId} onTyres={tyres !== null} />}
        <main id="main" tabIndex={-1} className="flex-1 pb-12">
          <Suspense fallback={<Skeleton className="h-[60vh]" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

/** Sticky broadcast-style bar: brand, sections, live state or next session, settings. */
function SiteHeader() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div aria-hidden="true" className="h-1 bg-mark" />
      <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="StintLine">
          <span aria-hidden="true" className="flex gap-0.5">
            <span className="h-6 w-2 -skew-x-[18deg] bg-mark" />
            <span className="h-6 w-1 -skew-x-[18deg] bg-mark/60" />
          </span>
          <span className="text-xl font-black tracking-tight uppercase italic">
            Stint<span className="text-mark-text">Line</span>
          </span>
        </Link>
        <nav aria-label={t("nav.label")} className="hidden h-full items-stretch gap-5 lg:flex">
          <LiveNavLink />
          {SECTIONS.map(([to, key]) => (
            <NavLink key={to} to={to} className={navLink}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NextSessionChip />
          <div className="hidden items-center sm:flex">
            <LanguageToggle />
          </div>
          <ThemeToggle />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? t("nav.close") : t("nav.menu")}
            onClick={() => {
              setOpenOn(open ? null : pathname);
            }}
            className="inline-flex size-10 items-center justify-center rounded-md hover:bg-raised lg:hidden"
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
      </div>
      {open && (
        <nav
          id="site-menu"
          aria-label={t("nav.label")}
          className="border-t border-line bg-bg px-4 pb-6 lg:hidden"
        >
          <ul className="mx-auto flex max-w-[1360px] flex-col">
            <li>
              <NavLink
                to="/live"
                className="flex items-center gap-3 border-b border-line py-4 text-2xl font-bold uppercase"
              >
                <LiveDot />
                {t("nav.live")}
              </NavLink>
            </li>
            {SECTIONS.map(([to, key]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `block border-b border-line py-4 text-2xl font-bold uppercase ${
                      isActive ? "text-mark-text" : ""
                    }`
                  }
                >
                  {t(key)}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-4 sm:hidden">
            <LanguageToggle />
          </div>
        </nav>
      )}
    </header>
  );
}

function LiveDot() {
  const live = useLiveStatus().data?.state === "live";
  return (
    <span aria-hidden="true" className="relative flex size-2.5">
      {live && <span className="absolute inset-0 animate-ping rounded-full bg-mark opacity-75" />}
      <span className={`relative size-2.5 rounded-full ${live ? "bg-mark" : "bg-line-strong"}`} />
    </span>
  );
}

function LiveNavLink() {
  const { t } = useI18n();
  const live = useLiveStatus().data?.state === "live";
  return (
    <NavLink to="/live" className={navLink}>
      <span className="inline-flex items-center gap-2">
        <LiveDot />
        {t("nav.live")}
        {live && <span className="sr-only"> ({t("live.now")})</span>}
      </span>
    </NavLink>
  );
}

/** "LIVE" while a session runs, otherwise the next session and a countdown. */
function NextSessionChip() {
  const { t, locale } = useI18n();
  const status = useLiveStatus().data;
  const now = useClock(30_000);
  if (status?.state === "live") {
    return (
      <Link
        to="/live"
        className="flex items-center gap-2 rounded-full bg-mark px-3 py-1 text-sm font-bold text-white uppercase"
      >
        <span className="size-2 animate-pulse rounded-full bg-white" />
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
    <Link
      to="/live"
      className="hidden items-center gap-3 rounded-lg border border-line bg-panel px-3 py-1.5 text-sm hover:border-line-strong xl:flex"
    >
      <span className="flex flex-col leading-tight">
        <span className="text-[0.65rem] font-semibold tracking-widest text-muted uppercase">
          {t("header.next")} · {sessionLabel(next.kind, t)}
        </span>
        <span className="font-bold">{eventName(next.event_name, locale)}</span>
      </span>
      <span className="rounded-md bg-raised px-2 py-1 font-black text-mark-text tabular-nums">
        {when}
      </span>
    </Link>
  );
}

function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto border-t border-line bg-panel">
      <div className="mx-auto grid w-full max-w-[1360px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <span className="text-lg font-black tracking-tight uppercase italic">
            Stint<span className="text-mark-text">Line</span>
          </span>
          <p className="max-w-md text-sm text-muted">{t("footer.pitch")}</p>
          <ApiStatus />
        </div>
        <nav aria-label={t("footer.explore")} className="flex flex-col gap-2 text-sm">
          <span className="font-bold tracking-wide uppercase">{t("footer.explore")}</span>
          {SECTIONS.slice(0, 4).map(([to, key]) => (
            <Link key={to} to={to} className="text-muted hover:text-ink">
              {t(key)}
            </Link>
          ))}
        </nav>
        <nav aria-label={t("footer.more")} className="flex flex-col gap-2 text-sm">
          <span className="font-bold tracking-wide uppercase">{t("footer.more")}</span>
          <Link to="/live" className="text-muted hover:text-ink">
            {t("nav.live")}
          </Link>
          {SECTIONS.slice(4).map(([to, key]) => (
            <Link key={to} to={to} className="text-muted hover:text-ink">
              {t(key)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-[1360px] px-4 py-4 text-xs text-muted sm:px-6">
          {t("app.disclaimer")}
        </p>
      </div>
    </footer>
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
        <NavLink to={`/sessions/${sessionId}`} end className={tabLink}>
          {t("nav.circuit")}
        </NavLink>
        <NavLink to={`/sessions/${sessionId}/tyres`} className={tabLink}>
          {t("nav.tyres")}
        </NavLink>
        {eventId !== undefined && (
          <NavLink to={`/events/${eventId}`} className={tabLink}>
            {t("nav.event")}
          </NavLink>
        )}
      </nav>
    </div>
  );
}
