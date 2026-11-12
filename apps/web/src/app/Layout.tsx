import { type ReactNode, Suspense, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  Crosshair,
  Gauge,
  House,
  type LucideIcon,
  Newspaper,
  RadioTower,
  Route,
  Swords,
  Trophy,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { ApiStatus } from "@/features/health/ApiStatus";
import { useLiveStatus } from "@/features/live/api";
import { useSessionDetail } from "@/features/race/api";
import { RacePicker } from "@/features/session-picker/RacePicker";
import { eventName } from "@/lib/i18n/content";
import type { MessageKey } from "@/lib/i18n/en";
import { useI18n } from "@/lib/i18n/context";
import { sessionLabel } from "@/lib/sessions";
import { timeLeft, useClock } from "@/lib/useClock";

import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

type Section = readonly [to: string, key: MessageKey, icon: LucideIcon];

/** The site map, grouped by what a fan is looking for. */
const GROUPS: readonly { key: MessageKey; links: readonly Section[] }[] = [
  {
    key: "nav.group.weekend",
    links: [
      ["/", "nav.home", House],
      ["/live", "nav.live", RadioTower],
      ["/calendar", "nav.calendar", CalendarDays],
    ],
  },
  {
    key: "nav.group.championship",
    links: [
      ["/standings", "nav.standings", Trophy],
      ["/drivers", "nav.drivers", UserRound],
      ["/teams", "nav.teams", UsersRound],
    ],
  },
  {
    key: "nav.group.analysis",
    links: [
      ["/analysis", "nav.headToHead", Swords],
      ["/analysis/pace", "nav.pace", ChartNoAxesColumn],
      ["/analysis/consistency", "nav.consistency", Crosshair],
      ["/analysis/pit-stops", "nav.pitStops", Wrench],
      ["/circuits", "nav.circuits", Route],
    ],
  },
  { key: "nav.group.paddock", links: [["/news", "nav.news", Newspaper]] },
  { key: "nav.group.about", links: [["/model", "nav.model", BookOpen]] },
];

const railLink = ({ isActive }: { isActive: boolean }) =>
  `mx-2 flex h-10 items-center gap-3 rounded-md px-3 text-[0.92rem] transition-colors ${
    isActive
      ? "bg-mark/15 font-semibold text-ink [&>svg]:text-mark-text"
      : "text-muted hover:bg-raised hover:text-ink"
  }`;

const tabLink = ({ isActive }: { isActive: boolean }) =>
  `flex h-12 shrink-0 items-center border-b-2 font-semibold ${
    isActive ? "border-mark text-ink" : "border-transparent text-muted hover:text-ink"
  }`;

export function Layout() {
  const { t } = useI18n();
  const tyres = useMatch("/sessions/:sessionId/tyres");
  const race = useMatch("/sessions/:sessionId");
  const raw = (tyres ?? race)?.params.sessionId;
  const sessionId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 bg-panel px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("app.skip")}
      </a>
      <Rail />
      <div className="flex min-h-screen min-w-0 flex-col">
        <ContextBar>
          {sessionId !== null && <RaceBar sessionId={sessionId} onTyres={tyres !== null} />}
        </ContextBar>
        <div className="mx-auto flex w-full max-w-[1840px] flex-1 flex-col px-4 pt-6 sm:px-8">
          <main id="main" tabIndex={-1} className="flex-1 pb-16">
            <Suspense fallback={<Skeleton className="h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="StintLine">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-md bg-mark text-white"
      >
        <Gauge className="size-5" strokeWidth={2.25} />
      </span>
      <span className="text-lg leading-none font-extrabold tracking-tight">
        Stint<span className="text-mark-text">Line</span>
      </span>
    </Link>
  );
}

function NavGroups({ onPick }: { onPick?: () => void }) {
  const { t } = useI18n();
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.key} className="flex flex-col">
          <span className="px-5 pt-5 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted/80 uppercase">
            {t(group.key)}
          </span>
          <ul className="flex flex-col">
            {group.links.map(([to, key, Icon]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/" || to === "/analysis"}
                  className={railLink}
                  onClick={onPick}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{t(key)}</span>
                  {to === "/live" && <LiveMark />}
                  {to === "/live" && <LiveNote />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Desktop: the site map in a fixed rail. Phones get a top bar and a drawer instead. */
function Rail() {
  const { t } = useI18n();
  return (
    <div className="hidden border-r border-line bg-panel lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-5">
          <Wordmark />
        </div>
        <nav aria-label={t("nav.label")} className="flex-1 overflow-y-auto pb-4">
          <NavGroups />
        </nav>
        <div className="border-t border-line px-3 py-2">
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}

/** Live state as on a timing screen: a kerb flag when a session runs, a grey tick otherwise. */
function LiveMark() {
  const live = useLiveStatus().data?.state === "live";
  return (
    <span
      aria-hidden="true"
      className={`size-2 rounded-full ${live ? "animate-pulse bg-mark" : "bg-line-strong"}`}
    />
  );
}

function LiveNote() {
  const { t } = useI18n();
  const live = useLiveStatus().data?.state === "live";
  return live ? <span className="sr-only"> ({t("live.now")})</span> : null;
}

/**
 * The bar above every page: the race context on race pages (picker and views), the next
 * session or the live state on the right. On phones it also carries the brand and the menu.
 */
function ContextBar({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  // The menu belongs to the page it was opened on: navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
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

function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>{t("app.disclaimer")}</p>
        <ApiStatus />
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
    <>
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
    </>
  );
}
