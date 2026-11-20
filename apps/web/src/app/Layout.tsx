import { type ReactNode, Suspense, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  Cog,
  Crosshair,
  FileText,
  Gauge,
  House,
  type LucideIcon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  Route,
  Swords,
  Trophy,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatch } from "react-router";

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
import { isRailShortcut, useRail } from "./rail";
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
  {
    key: "nav.group.paddock",
    links: [
      ["/news", "nav.news", Newspaper],
      ["/documents", "nav.documents", FileText],
      ["/technical", "nav.technical", Cog],
    ],
  },
  { key: "nav.group.about", links: [["/model", "nav.model", BookOpen]] },
];

const railLink = ({ isActive }: { isActive: boolean }) =>
  `relative mx-2 flex h-10 items-center gap-3 rounded-lg px-3 text-[0.92rem] transition-colors ${
    isActive
      ? "bg-ink font-semibold text-bg [&>svg]:text-bg"
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
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] motion-safe:lg:transition-[grid-template-columns] motion-safe:lg:duration-200 lg:rail-collapsed:grid-cols-[4.5rem_minmax(0,1fr)]">
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
          <main id="main" tabIndex={-1} className="flex-1 pb-16 outline-none">
            <Suspense fallback={<Skeleton className="h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <SiteFooter />
      </div>
      <ScrollRestoration />
      <RouteAnnouncer />
    </div>
  );
}

/** Time for a lazy page to load and set its title before it is announced. */
const ANNOUNCE_DELAY_MS = 600;

/**
 * A new page (not a new filter) moves the focus to the content and announces the page
 * title, as a full page load would for screen readers.
 */
function RouteAnnouncer() {
  const location = useLocation();
  const { pathname } = location;
  const state: unknown = location.state;
  const keepFocus =
    typeof state === "object" && state !== null && "keepFocus" in state && state.keepFocus === true;
  const first = useRef(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!keepFocus) document.getElementById("main")?.focus({ preventScroll: true });
    const timer = window.setTimeout(() => {
      setMessage(document.title);
    }, ANNOUNCE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, keepFocus]);
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
}

/** `compact`: the desktop rail keeps only the badge when it is reduced. */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="StintLine">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[10px] bg-mark text-white shadow-[0_6px_18px_-4px_var(--color-mark)]"
      >
        <Gauge className="size-5" strokeWidth={2.25} />
      </span>
      <span
        className={`text-lg leading-none font-extrabold tracking-tight ${compact ? "lg:rail-collapsed:hidden" : ""}`}
      >
        Stint<span className="text-mark-text">Line</span>
      </span>
    </Link>
  );
}

interface Tip {
  label: string;
  top: number;
}

/**
 * The site map. In the desktop rail (`rail`), the reduced state keeps the icons: names
 * stay for screen readers, group titles become dividers and `onTip` shows the name beside
 * the icon on hover and focus.
 */
function NavGroups({
  onPick,
  rail = false,
  onTip,
}: {
  onPick?: () => void;
  rail?: boolean;
  onTip?: ((tip: Tip | null) => void) | undefined;
}) {
  const { t } = useI18n();
  const show = (label: string) => (event: { currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect();
    onTip?.({ label, top: box.top + box.height / 2 });
  };
  const hide = () => {
    onTip?.(null);
  };
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.key} className="flex flex-col">
          <span
            className={`px-5 pt-5 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted/80 uppercase ${rail ? "rail-collapsed:sr-only" : ""}`}
          >
            {t(group.key)}
          </span>
          {rail && (
            <span
              aria-hidden="true"
              className="mx-4 mt-3 mb-2 hidden h-px bg-line rail-collapsed:block"
            />
          )}
          <ul className="flex flex-col">
            {group.links.map(([to, key, Icon]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/" || to === "/analysis"}
                  className={(state) =>
                    `${railLink(state)} ${rail ? "rail-collapsed:mx-auto rail-collapsed:w-10 rail-collapsed:justify-center rail-collapsed:px-0" : ""}`
                  }
                  onClick={onPick}
                  onMouseEnter={rail ? show(t(key)) : undefined}
                  onFocus={rail ? show(t(key)) : undefined}
                  onMouseLeave={rail ? hide : undefined}
                  onBlur={rail ? hide : undefined}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className={`flex-1 ${rail ? "rail-collapsed:sr-only" : ""}`}>{t(key)}</span>
                  {to === "/live" && (
                    <LiveMark
                      className={
                        rail
                          ? "rail-collapsed:absolute rail-collapsed:top-1.5 rail-collapsed:right-1.5"
                          : ""
                      }
                    />
                  )}
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

/**
 * Desktop: the site map in a fixed rail, which the reader can reduce to icons (button or
 * `[`, remembered). Phones get a top bar and a drawer instead.
 */
function Rail() {
  const { t } = useI18n();
  const { rail, toggle } = useRail();
  const [tip, setTip] = useState<Tip | null>(null);
  const collapsed = rail === "collapsed";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isRailShortcut(event)) return;
      event.preventDefault();
      setTip(null);
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  const label = collapsed ? t("nav.expand") : t("nav.collapse");
  return (
    <div className="hidden border-r border-line bg-bg lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-5 rail-collapsed:justify-center rail-collapsed:px-0">
          <Wordmark compact />
        </div>
        <nav
          id="site-rail"
          aria-label={t("nav.label")}
          className="flex-1 overflow-x-hidden overflow-y-auto pb-4"
        >
          <NavGroups rail onTip={collapsed ? setTip : undefined} />
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 rail-collapsed:flex-col rail-collapsed:px-2">
          <LanguageToggle className="rail-collapsed:flex-col" />
          <button
            type="button"
            onClick={() => {
              setTip(null);
              toggle();
            }}
            aria-controls="site-rail"
            aria-expanded={!collapsed}
            aria-label={label}
            title={`${label} ([)`}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
      {collapsed && tip && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[4.75rem] z-50 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-bg shadow-lg"
          style={{ top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}

/** Live state as on a timing screen: a kerb flag when a session runs, a grey tick otherwise. */
function LiveMark({ className = "" }: { className?: string }) {
  const live = useLiveStatus().data?.state === "live";
  return (
    <span
      aria-hidden="true"
      className={`size-2 rounded-full ${live ? "animate-pulse bg-mark" : "bg-line-strong"} ${className}`}
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
